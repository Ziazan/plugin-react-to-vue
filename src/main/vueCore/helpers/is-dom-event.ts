/**
 * 事件名称是否是DOM 事件
 */

import { DOM_EVENT_NAMES } from './constants/domEventConstants';

export default function isDOMEvent(eventName: string): boolean {
  return DOM_EVENT_NAMES.includes(eventName);
}
