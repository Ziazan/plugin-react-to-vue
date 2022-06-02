import { getFunctionBody,genImportSpecifier,getComponentTemplate,transFnPropsToVueProps} from "./utils"
import generator from '@babel/generator';
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
    }
    //参数
    
    if(funcCom.componentName === root.exportName){
        let paramsPath = path.get('params.0')
        //处理参数
        if(paramsPath){
            root.vueImportSpecifiers.push(genImportSpecifier('defineProps'));
            funcCom.scriptNode.push(transFnPropsToVueProps(path.node));
        }
        let jsxPath = undefined;
        path.traverse({
            enter(path: t.NodePath<any>) {
                if (
                  t.isDefaultFunctionReturnStatement({
                    // 调过组件函数本身的 return
                    functionAstNode: path.node,
                    returnStatementPath: path,
                  })
                ) {
                  jsxPath = path;
                  path.stop();
                }
              },
        })
        // 处理script代码
        jsxPath.parentPath.getAllPrevSiblings().forEach((scriptNodePath)=>{
            funcCom.scriptNode.push(scriptNodePath.node)
        })

        if (jsxPath) {
            funcCom.template += getComponentTemplate({
              componentAst: jsxPath.node!,
              scriptAsts: funcCom.scriptNode,
              withJSXVariableDeclarations: [],
              withJSXFunctionDeclarations: [],
            });
        }
        root.functional.push(funcCom)
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
            })
            funcCom.scriptNode.push(pPath.node)
        }else{
            funcCom.scriptNode.push(path.node)
        }
        root.functional.push(funcCom)
       
    }
}