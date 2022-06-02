import { getFunctionBody,genImportSpecifier,getComponentTemplate,transFnPropsToVueProps,genFunctionCallExpression} from "./utils";
import generator from '@babel/generator';
import get from 'lodash/get';
import * as t from './helpers/ast';


export const traverseFunctional = (path, fileContent, root,funcType ='normal')=>{
    // TODO
    const funcCom = {
        components: [],
        functional: true,
        isJsxFunction:false,
        scriptNode:[],
        template:'',
        componentName: funcType === 'arrow' ? path.parentPath.node.id.name : path.node.id.name
    };

    let watchEffectFlag = false;
    //参数
    
    if(funcCom.componentName === root.exportName){
        let paramsPath = path.get('params.0');
        //处理参数
        if(paramsPath){
            root.vueImportSpecifiers.push(genImportSpecifier('defineProps'));
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
            }
        });
        
        // 处理script代码
        blockStatementBodyPath?.forEach((scriptNodePath)=>{
            // 处理react 关键函数
            scriptNodePath.traverse({
                CallExpression(path:t.NodePath<t.CallExpression>){
                    if(get(path.node,'callee.name') !== 'useEffect'){
                        path.skip();
                    }else{
                        watchEffectFlag = true;
                        const args1 = get(path.node,'arguments[0]');
                        const node = genFunctionCallExpression('watchEffect', [args1]);
                        path.replaceWith(node);
                    }
                }
            });
            funcCom.scriptNode.push(scriptNodePath.node);
        });
        // 追加useEffect 引入
        watchEffectFlag && root.vueImportSpecifiers.push(genImportSpecifier('watchEffect'));
        

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