import template from '@babel/template';
import generator from '@babel/generator';
import * as t from './../helpers/ast';
import { reactToVueMap } from './../helpers/constants';
import get from 'lodash/get';
import set from 'lodash/set';

/**
 * 类属性转变量声明
 * @param bodyStatementAst
 */
export const classPropertyToFn = (bodyStatementAst: t.Node) => {
  const id = t.identifier(get(bodyStatementAst, 'key.name'));
  const init = get(bodyStatementAst, 'value');
  const variableDeclarator = t.variableDeclarator(id, init);
  return t.variableDeclaration('const', [variableDeclarator]);
};

/**
 * 类方法转变量声明数
 * @param bodyStatementAst
 */
export const classMethodToFn = (bodyStatementAst: t.Node) => {
  const id = t.identifier(get(bodyStatementAst, 'key.name'));
  const params = get(bodyStatementAst, 'params');
  const body = get(bodyStatementAst, 'body');
  const async = get(bodyStatementAst, 'async');

  const arrowFnExp = t.arrowFunctionExpression(params, body, async);
  //   const init = get(bodyStatementAst, 'value');
  const variableDeclarator = t.variableDeclarator(id, arrowFnExp);
  return t.variableDeclaration('const', [variableDeclarator]);
};

export const classMethodToVueFnExpStatement = (bodyStatementAst: t.Node) => {
  const name = get(bodyStatementAst, 'key.name');
  const params = get(bodyStatementAst, 'params');
  const body = get(bodyStatementAst, 'body');
  const async = get(bodyStatementAst, 'async');
  const callExpressionArguments = [t.arrowFunctionExpression(params, body, async)];
  const callee = t.identifier(reactToVueMap[name]);
  const expression = t.callExpression(callee, callExpressionArguments);

  return t.expressionStatement(expression);
};

/**
 * state 更新为 reactive
 * @param bodyStatementAst
 */
export const updateReactiveByConstructor = (classMethod: t.Node) => {
  let stateObjectObjectExpression: t.Node = null;
  const body = get(classMethod, 'body.body');
  const index = body.findIndex((node) => {
    stateObjectObjectExpression = get(node, 'expression.right');
    return t.isClassMemberStateExpression(node);
  });
  const stateVariableDeclaration = genReactiveByConstructor(stateObjectObjectExpression, 'state', 'reactive');
  ~index && body.splice(index, 1, stateVariableDeclaration);
};

export const genReactiveByConstructor = (
  objectObjectExpression: t.Node,
  idName: string,
  calleeName: string
): t.Node => {
  const callee = t.identifier(calleeName);
  const properties = get(objectObjectExpression, 'properties') as t.ObjectProperty[];
  const callExpressionArguments = [t.objectExpression([...properties])];
  const callExpression = t.callExpression(callee, callExpressionArguments);
  const id = t.identifier(idName);
  const variableDeclarator = t.variableDeclarator(id, callExpression);
  return t.variableDeclaration('const', [variableDeclarator]);
};

/**
 *  函数 props => const props = defineProps({})
 * @param bodyStatementAst
 */
export const transFnPropsToVueProps = (functionWithParamsAst: t.Node) => {
  const params = get(functionWithParamsAst, 'params');
  const props = params?.[0] || [];
  const id = t.identifier('props');
  const callee = t.identifier('defineProps');
  let callExpressionArguments: any[] = [];
  if (t.isObjectPattern(props)) {
    //TODO 把props的 字段也传进来
    //{ data, className, type } =》defineProps({ data, className, type })
    const properties = get(props, 'properties') as t.ObjectProperty[];
    callExpressionArguments = [t.objectExpression([...properties])];
    // callExpressionArguments = [...props.properties];
  } else {
    callExpressionArguments = [t.objectExpression([])];
  }
  const callExpression = t.callExpression(callee, callExpressionArguments);

  const variableDeclarator = t.variableDeclarator(id, callExpression);
  return t.variableDeclaration('const', [variableDeclarator]);
};

/**
 * genImportSpecifier
 * @param localName
 * @param importedName
 * @returns
 */
export const genImportSpecifier = (localName: string, importedName?: string) => {
  const imported = t.identifier(importedName || localName);
  const local = t.identifier(localName);
  return t.importSpecifier(local, imported);
};

/**
 * genImportSpecifier
 * @param localName
 * @param importedName
 * @returns
 */
export const genImportImportDeclaration = (specifiers: any[], sourceStr: string) => {
  const source = t.stringLiteral(sourceStr);
  return t.importDeclaration(specifiers, source);
};

export const genExpressionStatement = (property) => {
  const buildExpressionStatement = template(`
   state.%%property%% = %%right%%;
  `);
  const name = get(property, 'key.name');
  const value = get(property, 'value');
  return buildExpressionStatement({
    property: name,
    right: generator(value).code,
  });
};

/**
 * 生成自执行函数
 * @param argument
 * @returns
 */
export const genIIFE = (argument) => {
  const buildExpressionStatement = template(`
    (%%argument%%)()
  `);
  return buildExpressionStatement({
    argument: argument,
  });
};

export const transformStateThisValue = (path: t.NodePath<t.CallExpression>) => {
  path.traverse({
    MemberExpression(path: t.NodePath<t.MemberExpression>) {
      const node = path.node;
      if (node.object.type === 'ThisExpression') {
        path.replaceWith(node.property);
      }
    },
  });
  return path;
};
