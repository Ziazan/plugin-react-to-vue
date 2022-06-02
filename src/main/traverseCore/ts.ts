
import * as t from './helpers/ast';

export default function (ast) {
  t.traverse(ast,{
    ExportNamedDeclaration (exportPath) {
      let declaration = exportPath.get('declaration');
      if (declaration && ( declaration.isTSInterfaceDeclaration() || declaration.isTSTypeAliasDeclaration())) {
        exportPath.remove();
      }
    },
    TSTypeParameterInstantiation (path) {
      path.remove();
    },
    TSTypeAnnotation (path) {
      path.remove();
    },
    TSAsExpression (path) {
      path.replaceWith(path.get('expression'));
    }
  });
  return ast;
}