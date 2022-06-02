import generator from '@babel/generator';
import template from '@babel/template';
import type { ResultType } from './types/index';
import get from 'lodash/get';
import * as t from './helpers/ast';
import { reactToVueLifeCycleMap } from './helpers/constants';
import { getFunctionBody, genImportSpecifier, getComponentTemplate,transFnPropsToVueProps,genVariableDeclaration } from './utils/index';
import { stringify } from 'querystring';

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
 * 生成nextTick
 * @param argument
 * @returns
 */
export const genNextTick = (argument) => {
  const buildExpressionStatement = template(`
    nextTick(%%argument%%)
    `);
  return buildExpressionStatement({
    argument: argument,
  });
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

/*
 * 处理this.xx
 */
function transformStateThisValue(path: t.NodePath<any>) {
  path.traverse({
    MemberExpression(memberPath:t.NodePath<t.MemberExpression>) {
      // this 转换
      if (memberPath.node.object.type === 'ThisExpression') {
        memberPath.replaceWith(memberPath.node.property);
      }
    },
  });
}

/*
 * 处理this.xx = xxx
 */
function transformThisAssignMent(path: t.NodePath<any>,root) {
  path.traverse({
    AssignmentExpression(assPath:t.NodePath<t.AssignmentExpression>){
      const leftPath = assPath.get('left');
      const rightPath = assPath.get('right');
      const {start:lStart,end:lEnd} = get(leftPath.node,'property') || {}
      const leftType = get(leftPath.node,'object.type')
      if (leftType === 'ThisExpression' && lStart) {
        // 替换this
        transformStateThisValue(rightPath);
        // TODO
        const name = root.source.slice(lStart, lEnd)
        const variableNode = genVariableDeclaration(name,generator(rightPath.node).code)
        assPath.parentPath.replaceWith(variableNode as t.Node);
      }
    },
  });
}


export const classMethodToVueFnExpStatement = (bodyStatementAst: t.Node) => {
  const name = get(bodyStatementAst, 'key.name');
  const params = get(bodyStatementAst, 'params');
  const body = get(bodyStatementAst, 'body');
  const async = get(bodyStatementAst, 'async');
  const callExpressionArguments = [t.arrowFunctionExpression(params, body, async)];
  const callee = t.identifier(reactToVueLifeCycleMap[name]);
  const expression = t.callExpression(callee, callExpressionArguments);

  return t.expressionStatement(expression);
};


/**
 * 解析构造函数
 * @param path
 * @param fileContent
 * @param resultClass
 * @param root
 */
 const parseConstructor = (path, fileContent, resultClass, root) => {
  path.traverse({
    ExpressionStatement(expressPath) {
      let node = expressPath.node;
      let sectionCon = fileContent.slice(node.start, node.end);
      // super
      // this.xxx.bind(this)
      if (/^super|\.bind\(this\)/.test(sectionCon)) {
        expressPath.remove();
        return;
      }
    },
  });
  root.vueImportSpecifiers.push(genImportSpecifier('reactive'));

  // reactive
  updateReactiveByConstructor(path.node);
  // props
  let paramName = path.get('params.0') ? path.get('params.0').node.name : null;
  paramName && root.vueImportSpecifiers.push(genImportSpecifier('defineProps'));
  resultClass.constructor = generator(transFnPropsToVueProps(path.node)).code + '\n';

  // 处理this.xx = 
  transformThisAssignMent(path,root);
  //替换特殊字符
  replaceSpecialStatement(path, fileContent, root);
  
  // 其他script代码
  path.node.body.body?.forEach((statementNode) => {
    resultClass.constructor += generator(statementNode).code + '\n';
  });
};

/**
 * 解析生命周期函数
 * @param path
 * @param method
 * @param fileContent
 * @param resultClass
 */
function parseLifeCycle(path, method, fileContent, resultClass, root) {
  // replace special statement
  replaceSpecialStatement(path, fileContent, root);
  // debugger
  let bodyAst = classMethodToVueFnExpStatement(path.node);
  resultClass.lifeCycles[method] = generator(bodyAst).code;
}

// parse render
function parseRender(path, fileContent, resultClass,root) {
  // retrieve special properties
  replaceSpecialStatement(path, fileContent, root);
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
  });

  if (jsxPath) {
    root.class.render += getComponentTemplate({
      componentAst: jsxPath.node!,
      scriptAsts: root.script,
      withJSXVariableDeclarations: [],
      withJSXFunctionDeclarations: [],
    });
    // 处理script代码
    jsxPath.parentPath.getAllPrevSiblings().forEach((scriptNodePath)=>{
      resultClass.scriptNode.push(scriptNodePath.node)
    })
  }
}

/*
 * replace setState 等一些特殊语句
 */
function replaceSpecialStatement(path, fileContent, root) {
  path.traverse({
    ExpressionStatement(expressPath) {
      let node = expressPath.node;
      if (!node.start) {
        return;
      }
      let sectionCon = fileContent.slice(node.start, node.end);
      let statement: any[] = [];
      if (/^this\.setState/.test(sectionCon)) {
        // transform setState
        transformSetState(expressPath, fileContent, root);
      }
      if (statement.length) {
        expressPath.replaceWithMultiple(statement);
      }
    },
    MemberExpression(path: t.NodePath<t.MemberExpression>) {
      // replace `this.xx` with `xx`
      const node = path.node;
      if (node.object.type === 'ThisExpression') {
        path.replaceWith(node.property);
      }
    },
    JSXAttribute(attrPath) {
      // TODO 处理jsx
    },
  });
}

/*
 * transform setState function
 */
function transformSetState(path, fileContent, root) {
  const expressionNode = path.node.expression;
  const properties = get(expressionNode, 'arguments[0].properties');
  const setStateCall = get(expressionNode, 'arguments[1]');
  const nodeList = properties?.map((property) => {
    return genExpressionStatement(property);
  });
  if (setStateCall) {
    root.vueImportSpecifiers.push(genImportSpecifier('nextTick'));
    nodeList.push(genNextTick(setStateCall));
  }
  path.replaceWithMultiple(nodeList);
}

/**
 * class 转换主函数
 * @param classPath
 * @param fileContent
 * @param root
 */
export const traverseClass = (classPath: t.NodePath<t.ClassDeclaration>, fileContent: string, root: ResultType) => {
  Object.assign(root.class, {
    static: {},
    data: {},
    constructor: [],
    render: '',
    scriptNode:[],
    methods: [],
    lifeCycles: {},
    components: [],
    componentName: classPath.node.id.name,
  });

  let resultClass = root.class;
  //
  classPath.traverse({
    ClassMethod(path: t.NodePath<t.ClassMethod>) {
      const methKeyName = get(path.node, 'key.name');
      switch (methKeyName) {
        case 'constructor':
          parseConstructor(path, fileContent, resultClass, root);
          break;
        case 'componentWillMount':
        case 'componentDidMount':
        case 'componentWillUpdate':
        case 'componentDidUpdate':
        case 'componentWillUnmount':
          //追加vue的import
          root.vueImportSpecifiers.push(genImportSpecifier(reactToVueLifeCycleMap[methKeyName]));
          parseLifeCycle(path, reactToVueLifeCycleMap[methKeyName], fileContent, resultClass, root);
          break;
        case 'shouldComponentUpdate':
        case 'componentWillReceiveProps':
          break;
        case 'render':
          parseRender(path, fileContent, resultClass,root);
          break;
        default:
          transformStateThisValue(classPath);
          break;
      }
    },
    ClassProperty(path) {},
  });
};
