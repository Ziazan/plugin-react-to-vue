/**
 * html 标签判断
 */
const HTML_TAGNAME_STRING =
  'a,abbr,acronym,address,applet,area,article,aside,audio,b,base,basefont,bdi,bdo,big,blockquote,body,br,button,canvas,caption,center,cite,code,col,colgroup,command,datalist,dd,del,details,dfn,dialog,dir,div,dl,dt,em,embed,fieldset,figcaption,figure,font,footer,form,frame,frameset,h1 to <h6>,head,header,hr,html,i,iframe,img,input,ins,kbd,keygen,label,legend,li,link,main,map,mark,menu,meta,meter,nav,noframes,noscript,object,ol,optgroup,option,output,p,param,pre,progress,q,rp,rt,ruby,s,samp,script,section,select,small,source,span,strike,strong,style,sub,summary,sup,table,tbody,td,textarea,tfoot,th,thead,time,template,title,tr,track,tt,u,ul,var,video,wbr';
const HTML_TAGS = ['div', 'span', 'img', 'input', 'a', 'h3', 'h2', 'h1', ...HTML_TAGNAME_STRING.split(',')];

export default function isHtmlTag(tag: string): boolean {
  return HTML_TAGS.includes(tag);
}
