import { getFunctionBody,genImportSpecifier,getComponentTemplate,transFnPropsToVueProps,genFunctionCallExpression} from "./utils";
import generator from '@babel/generator';
import get from 'lodash/get';
import * as t from './helpers/ast';

/**
 * 
 * @param stateArr 
 * @param idName 
 * @param calleeName 
 * @returns 
 */
export const genReactive = (
    idName: string,
    calleeName: string,
    propertyArr: Array<[t.Identifier,t.Identifier]>,
  ): t.Node => {
    const callee = t.identifier(calleeName);
    const properties = propertyArr.reduce((preArr,[keyNode,valueNode])=>{
         preArr.push(t.objectProperty(keyNode,valueNode || t.identifier('undefined')));
         return preArr;
    },[]);
    const callExpressionArguments = [t.objectExpression([...properties])];
    const callExpression = t.callExpression(callee, callExpressionArguments);
    const id = t.identifier(idName);
    const variableDeclarator = t.variableDeclarator(id, callExpression);
    return t.variableDeclaration('const', [variableDeclarator]);
  };

/**
 * 生成函数
 * @param calleeName 
 * @param callArguments 
 * @returns 
 */
export const genCallExpression = (
    calleeName:string,
    callArguments:t.Expression[]
):t.CallExpression =>{
    const callee = t.identifier(calleeName);
    const callExpression = t.callExpression(callee, callArguments);
    return callExpression;
};

export const genDefaultFnComObj = ()=>{
    return Object.create({
        components: [],
        functional: true,
        isJsxFunction:false,
        scriptNode:[],
        template:'',
        componentName: '',// 组件名称
        reactivity:{},
    });
};

export const traverseFunctional = (path, fileContent, root,funcType ='normal')=>{
    // TODO
    const funcCom = genDefaultFnComObj();
    funcCom.componentName = funcType === 'arrow' ? path.parentPath.node.id.name : path.node.id.name;

    //参数
    if(funcCom.componentName === root.exportName){
        let paramsPath = path.get('params.0');
        //处理参数
        if(paramsPath){
            root.vueImportSpecifiers.push(genImportSpecifier('defineProps'));
            //转换 const props = defineProps({})
            funcCom.scriptNode.push(transFnPropsToVueProps(path.node));
            funcCom.reactivity['defineProps'] = paramsPath.node.name;
        }
        let jsxPath = [];
        const blockStatementBodyPath = path.get('body.body');
        const blockStatementPath = path.get('body');
        path.traverse({
            ReturnStatement(returnPath: t.NodePath<t.ReturnStatement>){
                if(t.isDefaultFunctionReturnStatement({
                    // 调过组件函数本身的 return
                    functionAstNode: path.node,
                    returnStatementPath: returnPath,
                  })){
                      const ifStatementPath = returnPath.findParent(p=>p.isIfStatement());
                      if(ifStatementPath && ifStatementPath.isDescendant(blockStatementPath)){
                          //判断当前 的if代码 是否是指定 functionPath 的后代
                        jsxPath.push({...returnPath});
                        ifStatementPath.remove();
                        ifStatementPath.skip();
                      }else{
                        jsxPath.push({...returnPath});
                        returnPath.remove();
                        returnPath.skip();
                      } 
                  }else if(t.hasJSXReturnStatement(returnPath)){
                    // 收集jsx 函数另外处理
                    const parentPath = returnPath.findParent(p=>p.isVariableDeclaration() || p.isFunctionDeclaration());
                    let compName = '';
                    if(parentPath.isVariableDeclaration()){
                        compName = get(parentPath.node,'declarations[0].id.name');
                    }else{
                        compName = get(parentPath.node,'id.name');
                    }
                    console.log('%c [ customer compName ]-103', 'font-size:13px; background:pink; color:#bf2c9f;', compName);
                    const JSXFuncCom = genDefaultFnComObj();
                    JSXFuncCom.componentName = compName;
                    JSXFuncCom.scriptNode.push(parentPath.node);
                    JSXFuncCom.isJsxFunction = true;
                    root.customComponents[compName] = JSXFuncCom;
                    parentPath.remove();
                  }
            },
            VariableDeclarator(varPath:t.NodePath<t.VariableDeclarator>){
                const name = get(varPath.node,'init.name');
                if(name === 'props'){
                    const initPath = varPath.get('init');
                    const {start:bStart,end:bEnd} = blockStatementPath.node;
                    const {start:vPStart,end:vPEnd} = varPath.parentPath.parentPath.node;
                    if(bStart === vPStart && bEnd === vPEnd){
                        const toRefsCallNode = genCallExpression('toRefs',[initPath.node]);
                        root.vueImportSpecifiers.push(genImportSpecifier('toRefs'));
                        initPath.replaceWith(toRefsCallNode);
                    }
                }
            }
        });

        // 处理script代码
        let stateIndex = -1; // 记住下标
        const useStateProperties = [];
        let watchEffectFlag = false;
        let refVars = []; // 收集uesRef的变量声明
        let useStateVarsAndSetter:Array<[string,string]> = []; // 收集useState的变量声明
        blockStatementBodyPath?.forEach((scriptNodePath,index)=>{
            let useStateFlag = false;
            // 处理useState
            scriptNodePath.traverse({
                CallExpression(callPath:t.NodePath<any>){
                    const name = get(callPath.node,'callee.name');
                    if(name === 'useState'){
                        useStateFlag = true;
                        if(!~stateIndex){
                            stateIndex = index;
                        }
                        const pPath = callPath.findParent((p)=>p.isVariableDeclarator());
                        const elementKeyNode = get(pPath.node,'id.elements[0]');
                        const elementSetNode = get(pPath.node,'id.elements[1]') || undefined;
                        const argumentsValueNode = get(callPath.node,'arguments[0]') || undefined;
                        elementKeyNode && useStateProperties.push([elementKeyNode,argumentsValueNode]);
                        useStateVarsAndSetter.push([elementKeyNode.name,elementSetNode?.name ?? '']);
                        pPath.remove();
                    }else if(name === 'useEffect'){
                        watchEffectFlag = true;
                        const args1 = get(callPath.node,'arguments[0]');
                        const node = genFunctionCallExpression('watchEffect', [args1]);
                        callPath.replaceWith(node);
                    }else if(name === 'useRef'){
                        //useRef  => ref
                        callPath.node.callee.name = 'ref';
                        // 收集ref的变量 ref.current => ref.value
                        const pPath = callPath.findParent((p)=>p.isVariableDeclarator());
                        const refVarName = get(pPath.node,'id.name');
                        refVars.push(refVarName);
                    }else{
                        callPath.skip();
                    }
                },
            });

            !useStateFlag && funcCom.scriptNode.push(scriptNodePath.node);
        });
        // useState => const state = reactive({})
        if(useStateVarsAndSetter?.length){
            root.vueImportSpecifiers.push(genImportSpecifier('reactive'));
            funcCom.scriptNode.splice(stateIndex,0,genReactive('state','reactive',useStateProperties));
            funcCom.reactivity['reactive'] = useStateVarsAndSetter;
        }
        // 追加useEffect 引入
        watchEffectFlag && root.vueImportSpecifiers.push(genImportSpecifier('watchEffect'));
        
        // 追加ref 引入
        if(refVars?.length){
            root.vueImportSpecifiers.push(genImportSpecifier('ref'));
            funcCom.reactivity['ref'] = refVars;
        };

        if (jsxPath.length) {
            console.log('%c  jsxPath.length:', 'color: #0e93e0;background: #aaefe5;', jsxPath.length);
            jsxPath.forEach((path)=>{
                funcCom.template += getComponentTemplate({
                    componentAst: path.node!,
                    scriptAsts: funcCom.scriptNode,
                    withJSXVariableDeclarations: [],
                    withJSXFunctionDeclarations: [],
                  });
            });
        }
        root.functional.push(funcCom);
    }else{
         //TODO 如果有jsx 就生成新文件
        if(t.hasJSXReturnStatement(path)){
            console.log('%c [ 如果有jsx 就生成新文件 ]-199', 'font-size:13px; background:pink; color:#bf2c9f;');
            let compName = '';
            let parentPath = path;
            if(funcType === 'arrow'){
                parentPath = path.findParent(p=>p.isVariableDeclaration());
                compName = get(parentPath.node,'declarations[0].id.name');
            }else{
                compName = get(path.node,'id.name');
            }
            const JSXFuncCom = genDefaultFnComObj();
            JSXFuncCom.componentName = compName;
            JSXFuncCom.scriptNode.push(parentPath.node);
            JSXFuncCom.isJsxFunction = true;
            root.customComponents[compName] = JSXFuncCom;
        }else{
            if(funcType === 'arrow'){
                // 箭头函数的定义
                const pPath = path.findParent((n)=>{
                    return n.isVariableDeclaration();
                });
                funcCom.scriptNode.push(pPath.node);
            }else{
                funcCom.scriptNode.push(path.node);
            }
            root.functional.push(funcCom);
        }
    }
};