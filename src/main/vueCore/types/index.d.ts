import * as t from './../helpers/ast';
export interface ResultType {
  importDeclaration: any[];
  exportDefaultDeclaration: t.NodePath<any>;
  variableDeclarations: any[];
  functionDeclarations: any[];
  declaration: any[];
  classDeclarations: any[];
  propTypes: { [key: string]: any };
  defaultProps: { [key: string]: any };
  /**
   * 收集vue 的导入
   */
  vueImportSpecifiers: any[];
  // there exists incompatibility
  caveats: any[];
  source: string;
}
