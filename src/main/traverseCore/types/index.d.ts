import * as t from './../helpers/ast';
export interface ResultType {
  import: any[];
  exportName: string;
  exportDefaultDeclaration: t.NodePath<any>;
  declaration: any[];
  class: { [key: string]: any };
  functional: any[];
  propTypes: { [key: string]: any };
  defaultProps: { [key: string]: any };
  script: any[];
  /**
   * 收集vue 的导入
   */
  vueImportSpecifiers: any[];
  caveats: any[];
  source: string;
}
