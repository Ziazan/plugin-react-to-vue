import generator from '@babel/generator';
import type { ResultType } from './types/index';
import * as t from './helpers/ast';
import { traverseClass } from './class';
import { traverseFunctional } from './functional';
import { generateVueComponent } from './generate';
import get from 'lodash/get';
import {genReactProgramScript,tools} from './utils';
import {genReact2VueBySourceCode} from './index';



interface generateR2SCodeParams {
  sourceAst: any;
  sourceCode: string;
}

export function generateR2SCode({ sourceAst, sourceCode }: generateR2SCodeParams,targetFile): string {
  // traverse module
  let result: ResultType = {
    import: [],
    exportName: '',
    exportDefaultDeclaration: null,
    declaration: [],
    class: {},
    functional: [],
    propTypes: {},
    defaultProps: {},
    vueImportSpecifiers: [],
    script: [],
    // there exists incompatibility
    caveats: [],
    source: sourceCode,
    customComponents:{},
    targetFile:targetFile,
  };
  const fileContent = sourceCode;

  t.traverse(sourceAst, {
    Program(path: t.NodePath<t.Program>) {
      // 第一层级的代码处理
      const programBodyNodeList = path.node.body;
      programBodyNodeList.forEach((childNode, index) => {
        let childPath = path.get(`body.${index}`) as t.NodePath<any>;
        if (t.isExportDefaultDeclaration(childNode)) {
          if(t.isCallExpression(childNode.declaration)){
            const argumentsName = get(childNode.declaration,'arguments[0].name');
            result.exportName = argumentsName;
          }else if(t.isIdentifier(childNode.declaration)){
            result.exportName = childNode.declaration.name;
          }else if(t.isFunctionDeclaration(childNode.declaration)){
            result.exportName = childNode.declaration.id?.name;
          }
        } else if (t.isVariableDeclaration(childNode) && !t.isVariableFunc(childPath)) {
          // 变量定义
          // TODO 追加到其他 
          result.script.push(fileContent.slice(childNode.start, childNode.end));
        }else if (t.isExportNamedDeclaration(childNode)){
          console.log('isExportNamedDeclaration: ');
          const declarationNode = childNode.declaration;
          const importScript = result.import.join('\n');
          const variableDeclaration = generator(declarationNode).code;
          let componentName = 'default';
          if(t.isVariableDeclaration(declarationNode)){
            componentName = get(declarationNode,'declarations[0].id.name');
          }else if(t.isFunctionDeclaration(declarationNode)){
            componentName = get(declarationNode,'id.name');
          }
          const reactProgramScript = genReactProgramScript({
            functionScript:`${importScript}\n${variableDeclaration}`,
            exportName:componentName,
          });
          const dirPath = result.targetFile.split('/');
          const fileName = dirPath.pop();
          const compFileName = `${tools.toHorizontalLine(`${fileName.split('.')[0]}${componentName[0].toUpperCase()}${componentName.slice(1)}`)}`;
          console.log('compFileName: ', compFileName);
          genReact2VueBySourceCode(reactProgramScript,`${dirPath.join('/')}/${compFileName}.vue`);
        }
      });
    },
    ImportDeclaration(path: t.NodePath<t.ImportDeclaration>) {
      const node = path.node;
      if (['react', 'prop-types', 'react-dom'].includes(node.source.value)) {
        return;
      }
      //css 跳过
      if(/.*?\.less/.test(node.source.value)){
        return;
      }
      result.import.push(fileContent.slice(node.start, node.end));
    },
    ClassDeclaration(path: t.NodePath<t.ClassDeclaration>) {
      if (path.parentPath.type !== 'Program' && path.parentPath.type !== 'ExportDefaultDeclaration') {
        result.caveats.push('不支持的导出类型');
      }
      if (path.node.decorators) {
        result.caveats.push('装饰器暂不支持');
      }
      //TODO
      traverseClass(path, fileContent, result);
    },
    FunctionDeclaration(path) {
      if (path.parentPath.type !== 'Program' && path.parentPath.type !== 'ExportDefaultDeclaration') {
        path.skip();
      }else{
        traverseFunctional(path, fileContent, result);
      }
    },
    ArrowFunctionExpression(path: t.NodePath<t.ArrowFunctionExpression>) {
      let variablePath = path.findParent((p) => {
        return p.isVariableDeclaration();
      });
      if (!variablePath || variablePath.parentPath.type !== 'Program'  || path.getPathLocation().split('.').length > 4 ) {
        //program.body[2].declarations[0].init
        path.skip();
      } else {
        traverseFunctional(path, fileContent, result, 'arrow');
      }
    },
  });

  // 生成vue代码
  const content = generateVueComponent(result);

  // output caveats
  if (result.caveats.length) {
    console.log('Caveats:');
    console.log(result.caveats.join('\n'));
  }

  return content;
}
