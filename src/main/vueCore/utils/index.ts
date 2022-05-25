import generator from '@babel/generator';
import * as t from './../helpers/ast';
import type { ResultType } from './../types/index';
import { getComponentTemplate, genCommentLineAst } from './template';
import { reactToVueMap } from './../helpers/constants/index';
import {
  classPropertyToFn,
  classMethodToFn,
  transFnPropsToVueProps,
  updateReactiveByConstructor,
  genImportSpecifier,
  genImportImportDeclaration,
  classMethodToVueFnExpStatement,
  genExpressionStatement,
  genIIFE,
  transformStateThisValue,
} from './class';
import { getClassRenderAstNode } from './node';
import get from 'lodash/get';
import set from 'lodash/set';

export * from './template';
export * from './class';
export * as tools from './tools';

interface TGetAllDeclarationsReturn {
  importDeclaration: t.NodePath<t.ImportDeclaration>[];
  exportDefaultDeclaration: t.NodePath<t.ExportDefaultDeclaration>;
  exportNamedDeclarations: t.NodePath<t.ExportNamedDeclaration>[];
  variableDeclarations: t.NodePath<t.VariableDeclaration>[];
  functionDeclarations: t.NodePath<t.FunctionDeclaration>[];
  classDeclarations: t.NodePath<t.ClassDeclaration>[];
}
/**
 * 获取所有的定义类型
 * @param ast
 * @returns
 */
export const getAllDeclarations = (ast: t.Node): TGetAllDeclarationsReturn => {
  let exportDefaultDeclaration = null;
  let exportNamedDeclarations: any[] = [];
  let variableDeclarations: any[] = [];
  let functionDeclarations: any[] = [];
  let importDeclaration: any[] = [];
  let classDeclarations: any[] = [];

  t.traverse(ast, {
    //导入
    ImportDeclaration(path: t.NodePath<t.ImportDeclaration>) {
      if (['react', 'prop-types', 'react-dom'].includes(path.node.source.value)) {
        return;
      }
      importDeclaration.push(path);
    },
    // 导出
    ExportDefaultDeclaration(path: t.NodePath<t.ExportDefaultDeclaration>) {
      exportDefaultDeclaration = path;
    },
    VariableDeclaration(path: t.NodePath<t.VariableDeclaration>) {
      variableDeclarations.push(path);
    },
    FunctionDeclaration(path: t.NodePath<t.FunctionDeclaration>) {
      functionDeclarations.push(path);
    },
    ClassDeclaration(path: t.NodePath<t.ClassDeclaration>) {
      classDeclarations.push(path);
    },
    //TODO 暂时不处理
    //TODO export {a,b}  //TODO ExportAllDeclaration export * from 'c'
    //   ExportNamedDeclaration(path: t.NodePath<t.ExportNamedDeclaration>) {
    //     exportNamedDeclarations.push(path);
    //   },
  });
  return {
    importDeclaration,
    exportDefaultDeclaration,
    exportNamedDeclarations,
    variableDeclarations,
    functionDeclarations,
    classDeclarations,
  };
};

/**
 * 获取默认导出的ast
 * @param result
 * @returns
 */
export const getExportDefaultComponentAst = (result: ResultType): t.NodePath<any> | null => {
  const { exportDefaultDeclaration, variableDeclarations, functionDeclarations, classDeclarations } = result;
  // console.log(
  //   '%c [ exportDefaultDeclaration ]-66',
  //   'font-size:13px; background:pink; color:#bf2c9f;',
  //   generator(exportDefaultDeclaration.node).code
  // );
  let exportDefaultComponentName = '';
  const declarationOfExportDefaultDeclaration = exportDefaultDeclaration.node.declaration;
  if (t.isIdentifier(declarationOfExportDefaultDeclaration)) {
    exportDefaultComponentName = get(exportDefaultDeclaration.node.declaration, 'name');
    // 类
    for (let classDeclaration of classDeclarations) {
      if (get(classDeclaration.node, 'id.name') === exportDefaultComponentName) {
        return classDeclaration;
      }
    }
    //函数
    for (let functionDeclaration of functionDeclarations) {
      if (get(functionDeclaration.node, 'id.name') === exportDefaultComponentName) {
        return functionDeclaration;
      }
    }
    // 导出的是变量箭头函数 或JSXElement
    // const pre_nodepath = exportDefaultDeclaration.getAllPrevSiblings();
    for (let variableDeclaration of variableDeclarations) {
      // console.log(
      //   '%c [ nodePath ]-77',
      //   'font-size:13px; background:pink; color:#bf2c9f;',
      //   generator(variableDeclaration.node).code
      // );
      for (let declaration of variableDeclaration.node.declarations) {
        if (get(declaration, 'id.name') === exportDefaultComponentName) {
          return variableDeclaration;
        }
      }
    }
  } else if (t.isFunctionDeclaration(declarationOfExportDefaultDeclaration)) {
    // 直接导出函数
    console.log('%c [ 直接导出函数 ]-91', 'font-size:13px; background:pink; color:#bf2c9f;');
    return exportDefaultDeclaration;
  } else if (t.isArrowFunctionExpression(declarationOfExportDefaultDeclaration)) {
    // 直接导出箭头函数
    console.log('%c  箭头函数:', 'color: #0e93e0;background: #aaefe5;');
    return exportDefaultDeclaration;
  } else if (t.isClassDeclaration(declarationOfExportDefaultDeclaration)) {
    // 直接导出类
    console.log('%c [ 直接导出类 ]-104', 'font-size:13px; background:pink; color:#bf2c9f;');
    return exportDefaultDeclaration;
  } else if (t.isJSXElement(declarationOfExportDefaultDeclaration)) {
    // 直接导出jsx
    console.log('%c [ 直接导出jsx ]-122', 'font-size:13px; background:pink; color:#bf2c9f;');
    return exportDefaultDeclaration;
  }
  return null;
};

export const getExportDefaultComponentTemplate = (
  {
    exportDefaultComponentAst,
  }: {
    exportDefaultComponentAst: t.NodePath<any>;
  },
  result: ResultType
): {
  template: string;
  scriptAsts: any[];
} => {
  // console.log(
  //   '%c  exportDefaultComponentAst:',
  //   'color: #0e93e0;background: #aaefe5;',
  //   generator(exportDefaultComponentAst.node).code
  // );
  let { vueImportSpecifiers } = result;
  let scriptAsts: t.Node[] = [];
  let componentAst: t.NodePath<any> = undefined;
  let rootBlockNode = exportDefaultComponentAst.node;
  //TODO 多余的script代码都挪过去
  exportDefaultComponentAst.getAllPrevSiblings()?.forEach((nodePath) => {
    if (!t.isImportDeclaration(nodePath)) {
      scriptAsts.push(nodePath.node);
    }
  });
  // scriptAsts = scriptAsts.concat(exportDefaultComponentAst.getAllPrevSiblings());

  if (t.isVariableDeclaration(exportDefaultComponentAst)) {
    const functionAst = get(exportDefaultComponentAst.node, 'declarations[0].init');
    // console.log(
    //   '%c [ functionAst ]-114',
    //   'font-size:13px; background:pink; color:#bf2c9f;',
    //   generator(functionAst).code
    // );
    if (t.isArrowFunctionExpression(functionAst)) {
      //箭头函数
      if (functionAst.params.length) {
        // 追加属性定义
        vueImportSpecifiers.push(genImportSpecifier('defineProps'));
        scriptAsts.push(transFnPropsToVueProps(functionAst));
      }
      rootBlockNode = functionAst;
    } else if (t.isJSXElement(functionAst)) {
      //JSX
      rootBlockNode = functionAst;
    }
  } else if (t.isFunctionDeclaration(exportDefaultComponentAst)) {
    //声明函数
    // console.log(
    //   '%c [ functionAst ]-114',
    //   'font-size:13px; background:pink; color:#bf2c9f;',
    //   generator(exportDefaultComponentAst.node).code
    // );
    if (exportDefaultComponentAst.node.params.length) {
      // 追加vue属性定义
      vueImportSpecifiers.push(genImportSpecifier('defineProps'));
      scriptAsts.push(transFnPropsToVueProps(exportDefaultComponentAst.node));
    }
    rootBlockNode = exportDefaultComponentAst.node;
  } else if (t.isExportDefaultDeclaration(exportDefaultComponentAst)) {
    // console.log(
    //   '%c [ rootBlockNode ]-121',
    //   'font-size:13px; background:pink; color:#bf2c9f;',
    //   generator(rootBlockNode).code
    // );
    if (t.isClassDeclaration(exportDefaultComponentAst.node.declaration)) {
      // 类
      //TODO 类的props 从构造函数获取
      rootBlockNode = getClassRenderAstNode(exportDefaultComponentAst.node.declaration);
    } else {
      const functionAst = exportDefaultComponentAst.node.declaration;
      // 函数和箭头函数
      if (functionAst.params.length) {
        // 追加vue属性定义
        vueImportSpecifiers.push(genImportSpecifier('defineProps'));
        scriptAsts.push(transFnPropsToVueProps(functionAst));
      }
      rootBlockNode = exportDefaultComponentAst.node.declaration;
    }
  } else if (t.isClassDeclaration(exportDefaultComponentAst)) {
    // 类
    //TODO 类的props 从构造函数获取
    rootBlockNode = getClassRenderAstNode(exportDefaultComponentAst.node);
  }

  //TODO 区分script 和 template
  exportDefaultComponentAst.traverse({
    enter(path: t.NodePath<any>) {
      if (
        t.isDefaultFunctionReturnStatement({
          // 调过组件函数本身的 return
          functionAstNode: rootBlockNode,
          returnStatementPath: path,
        })
      ) {
        componentAst = path;
        path.stop();
      }
    },
  });
  //TODO ING 替换thi.setState
  exportDefaultComponentAst.traverse({
    MemberExpression(path: t.NodePath<t.MemberExpression>) {
      const node = path.node;
      if (node.object.type === 'ThisExpression') {
        path.replaceWith(node.property);
      }
    },
    CallExpression(path: t.NodePath<t.CallExpression>) {
      if (t.isThisSetSate(path.node)) {
        path = transformStateThisValue(path);
        const properties = get(path.node, 'arguments[0].properties');
        const setStateCall = get(path.node, 'arguments[1]');
        const nodeList = properties?.map((property) => {
          return genExpressionStatement(property);
        });
        //TODO 第二个参数转自执行
        setStateCall && nodeList.push(genIIFE(setStateCall));
        path.replaceWithMultiple(nodeList);
      }
    },
  });

  // console.log('%c  [ componentAst ]-187:', 'color: #0e93e0;background: #aaefe5;', generator(componentAst.node).code);
  const withJSXVariableDeclarations: any[] = [];
  const withJSXFunctionDeclarations: any[] = [];
  const { node: exportDefaultComponentNode } = exportDefaultComponentAst;
  const { body, params } = exportDefaultComponentNode;
  let blockBody = get(rootBlockNode, 'body');
  // 类 取类的body
  if (t.isClassDeclaration(exportDefaultComponentNode.declaration)) {
    blockBody = get(exportDefaultComponentNode.declaration, 'body');
  } else if (t.isClassDeclaration(exportDefaultComponentNode)) {
    console.log('%c [ isClassDeclaration ]-234', 'font-size:13px; background:pink; color:#bf2c9f;');
    blockBody = get(exportDefaultComponentNode, 'body');
  }
  // console.log('%c [ blockBody ]-221', 'font-size:13px; background:pink; color:#bf2c9f;', generator(blockBody).code);
  //处理javascript
  if (t.isBlockStatement(blockBody) || t.isClassBody(blockBody)) {
    for (let bodyStatementAst of blockBody.body) {
      if (t.isVariableDeclaration(bodyStatementAst)) {
        if (t.hasJSX(bodyStatementAst)) {
          withJSXVariableDeclarations.push(bodyStatementAst);
        } else {
          scriptAsts.push(bodyStatementAst);
        }
      } else if (t.isFunctionDeclaration(bodyStatementAst)) {
        if (t.hasJSX(bodyStatementAst)) {
          withJSXFunctionDeclarations.push(bodyStatementAst);
        } else {
          scriptAsts.push(bodyStatementAst);
        }
      } else if (t.isClassMethod(bodyStatementAst) && get(bodyStatementAst, 'key.name') !== 'render') {
        if (t.hasJSX(bodyStatementAst)) {
          withJSXFunctionDeclarations.push(bodyStatementAst);
        } else {
          // console.log(
          //   '%c [ isClassMethod ]-223',
          //   'font-size:13px; background:pink; color:#bf2c9f;',
          //   generator(bodyStatementAst).code
          // );
          //TODO 这里需要判断构造函数 constructor 需要提醒
          if (t.isClassMethod(bodyStatementAst, { kind: 'constructor' })) {
            vueImportSpecifiers.push(genImportSpecifier('defineProps'));
            scriptAsts.push(transFnPropsToVueProps(bodyStatementAst));
            //TODO 需要判断是否 有this.state才导入
            vueImportSpecifiers.push(genImportSpecifier('reactive'));
            updateReactiveByConstructor(bodyStatementAst);
          } else if (t.isReactCircleFnInClass(bodyStatementAst)) {
            //生命周期相关的函数转换
            const name = get(bodyStatementAst, 'key.name');
            vueImportSpecifiers.push(genImportSpecifier(reactToVueMap[name]));
            scriptAsts.push(classMethodToVueFnExpStatement(bodyStatementAst));
          } else {
            scriptAsts.push(classMethodToFn(bodyStatementAst));
          }
        }
      } else if (t.isClassProperty(bodyStatementAst)) {
        if (t.hasJSX(bodyStatementAst)) {
          withJSXFunctionDeclarations.push(bodyStatementAst);
        } else {
          // console.log(
          //   '%c [ isClassProperty ]-223',
          //   'font-size:13px; background:pink; color:#bf2c9f;',
          //   generator(bodyStatementAst).code
          // );
          //class 属性转成函数
          scriptAsts.push(classPropertyToFn(bodyStatementAst));
        }
      } else if (!t.hasJSX(bodyStatementAst)) {
        scriptAsts.push(bodyStatementAst);
      }
    }
  }

  // console.log('%c [ scriptAsts ]-265', 'font-size:13px; background:pink; color:#bf2c9f;', scriptAsts);
  return {
    template: getComponentTemplate({
      componentAst: componentAst.node,
      scriptAsts,
      withJSXVariableDeclarations: withJSXVariableDeclarations,
      withJSXFunctionDeclarations: withJSXVariableDeclarations,
    }),
    scriptAsts,
  };
};
