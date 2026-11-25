/** Shared document and SVG inks; CSS tokens intentionally match these values. */
export const INK={text:'#26332f',muted:'#55655c',paper:'#f7f7f2',line:'#d3d9d2',forest:'#304c43',summer:'#9b5037',winter:'#80602a',daylight:'#466556'} as const;
export const FONT_STACK='Inter, Segoe UI, PingFang SC, Microsoft YaHei, sans-serif';
/** Conservative CJK-aware line lengths, no injected SVG/HTML. */
export function wrapLabel(text:string,maxUnits=46):string[]{
 const lines:string[]=[];let line='',units=0;
 for(const char of text){const n=/[\u0000-\u007f]/.test(char)?.56:1;
  if(char==='\n'){lines.push(line);line='';units=0;continue}
  if(units+n>maxUnits&&line){lines.push(line.trimEnd());line='';units=0}
  line+=char;units+=n;
 }
 if(line||!lines.length)lines.push(line.trimEnd());return lines;
}
