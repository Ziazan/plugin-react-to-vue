import get from 'lodash/get';
import * as t from './../helpers/ast';

export const getClassRenderAstNode = (node: t.Node): t.NodePath<any> => {
  //   console.log('%c [ isClassDeclaration ]-149', 'font-size:13px; background:pink; color:#bf2c9f;');
  const classBodys = get(node, 'body.body');
  // console.log(
  //   '%c [ exportDefaultComponentAst.node.declaration ]-152',
  //   'font-size:13px; background:pink; color:#bf2c9f;',
  //   generator(exportDefaultComponentAst.node.declaration).code
  // );

  const renderAst = classBodys?.find((bodyItem) => {
    return t.isClassMethod(bodyItem) && get(bodyItem, 'key.name') === 'render';
  });
  // console.log('%c [ renderAst ]-165', 'font-size:13px; background:pink; color:#bf2c9f;', generator(renderAst).code);
  return renderAst;
};
