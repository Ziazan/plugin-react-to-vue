export const toHorizontalLine = (name) => {
  return name.replace(/(\B[A-Z])/g, '-$1').toLowerCase();
};

/**
 * template this 替换为 state
 * @param str
 * @param oldName
 * @param newName
 * @returns
 */
export const changeMemberExpressionByName = (str: string, oldName: string = 'this', newName: string = '') => {
  const reg = new RegExp(`(${oldName})\.`, 'g');
  const result = str.replace(reg, `${newName}`);
  return result;
};
