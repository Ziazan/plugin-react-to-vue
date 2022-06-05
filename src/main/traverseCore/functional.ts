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
         preArr.push(t.objectProperty(keyNode,valueNode));
         return preArr;
    },[]);
    const callExpressionArguments = [t.objectExpression([...properties])];
    const callExpression = t.callExpression(callee, callExpressionArguments);
    const id = t.identifier(idName);
    const variableDeclarator = t.variableDeclarator(id, callExpression);
    return t.variableDeclaration('const', [variableDeclarator]);
  };


export const traverseFunctional = (path, fileContent, root,funcType ='normal')=>{
    // TODO
    const funcCom = {
        components: [],
        functional: true,
        isJsxFunction:false,
        scriptNode:[],
        template:'',
        componentName: funcType === 'arrow' ? path.parentPath.node.id.name : path.node.id.name,
        reactivity:{},
    };

    //参数
    
    if(funcCom.componentName === root.exportName){
        let paramsPath = path.get('params.0');
        //处理参数
        if(paramsPath){
            funcCom.scriptNode.push(transFnPropsToVueProps(path.node));
        }
        let jsxPath = [];
        const blockStatementBodyPath = path.get('body.body');
        const blockStatementPath = path.get('body');
        path.traverse({
            ReturnStatement(returnPath: t.NodePath<any>){
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
                  }
            },
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
                        stateIndex = index;
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
                }
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
        // else 原样保留 输出script
        // if(true){
        //     funcCom.isJsxFunction = true;
        //     funcCom.scriptNode = []
        //     root.functional.push(funcCom)
        // }else{
        // }
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
};