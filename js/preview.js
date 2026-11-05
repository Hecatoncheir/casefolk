import {color, escape} from './config.js';

  function fan(cx,cy,r,ink,paper){
    return `<g transform="translate(${cx} ${cy})"><circle r="${r}" fill="${ink}"/><circle r="${r-5}" fill="${paper}"/>${Array.from({length:7},(_,i)=>`<path d="M0 -8 C${r*.62} ${-r*.9} ${r*.98} ${-r*.56} ${r*.58} ${-r*.08} C${r*.3} ${r*.13} 8 9 0 6Z" fill="${ink}" transform="rotate(${i*360/7})"/>`).join('')}<circle r="${r*.2}" fill="${paper}" stroke="${ink}" stroke-width="3"/></g>`;
  }
  export function scene(host,settings,tag){
    const frame=color(settings.frame).hex,panel=color(settings.panel).hex,ink='#262c25';
    const width=settings.size==='expanded'?240:200,left=settings.size==='expanded'?40:80;
    const top=settings.size==='expanded'?92:105;
    const meshId=`cf-mesh-${tag}`,topId=`cf-lines-${tag}`;
    const inside=settings.view==='inside'||settings.panelType==='clear';
    const sideWidth=width-27;
    const frontFans=Math.min(2,settings.fans),extra=Math.max(0,settings.fans-2);
    host.innerHTML=`<svg class="cf-scene" viewBox="0 0 500 485" role="img" aria-label="Стилизованный предпросмотр MODCASE HYPER: рама ${escape(color(settings.frame).name)}, панели ${escape(color(settings.panel).name)}, ${settings.fans} вентиляторов">
      <defs><pattern id="${meshId}" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".85" fill="${ink}" opacity=".6"/></pattern><pattern id="${topId}" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M0 1H5" stroke="${ink}" stroke-width=".5" opacity=".16"/></pattern></defs>
      <path d="M104 408L300 475 456 414 254 350Z" fill="#22291f" opacity=".14"/>
      <g stroke="${ink}" stroke-width="2.3" stroke-linejoin="round">
        <path d="M${left} ${top}L${left+135} ${top-65} 415 105 280 170Z" fill="${frame}"/>
        <path d="M${left+16} ${top+1}L${left+133} ${top-54} 397 106 280 158Z" fill="${panel}"/>
        <path d="M${left+16} ${top+1}L${left+133} ${top-54} 397 106 280 158Z" fill="url(#${meshId})" stroke="none"/>
        <g transform="matrix(1 .325 0 1 ${left} ${top})">
          <rect x="13" y="268" width="28" height="24" rx="7" fill="${ink}"/>
          <rect x="${width-42}" y="268" width="28" height="24" rx="7" fill="${ink}"/>
          <rect width="${width}" height="285" rx="9" fill="${frame}"/>
          <rect x="14" y="16" width="${sideWidth}" height="253" rx="5" fill="${inside?'#363e33':panel}"/>
          ${inside?`<rect x="31" y="35" width="${width-58}" height="162" rx="4" fill="#69765f"/><rect x="49" y="64" width="69" height="69" rx="3" fill="#b5bca7"/>${fan(83,99,25,ink,'#d8ddce')}<path d="M${width-49} 49V153 M${width-40} 49V153" stroke="#c7cfb6" stroke-width="5"/><rect x="26" y="163" width="${width-47}" height="35" rx="4" fill="#b9bea9"/><path d="M35 179H${width-30}" stroke="${ink}" stroke-width="4"/><rect x="28" y="219" width="65" height="34" rx="4" fill="#262c25"/><path d="M103 232H${width-27} M103 241H${width-27}" stroke="#9da68d" stroke-width="3"/>`: `<rect x="14" y="16" width="${sideWidth}" height="253" rx="5" fill="url(#${meshId})" stroke="none"/><rect x="14" y="16" width="${sideWidth}" height="253" rx="5" fill="url(#${topId})" stroke="none"/>`}
          ${inside&&settings.panelType==='clear'&&settings.view!=='inside'?`<path d="M37 155L${width-30} 32 M${width-77} 117L${width-29} 72" stroke="#f3f4df" opacity=".55" stroke-width="5"/>`:''}
          <path d="M5 12V274 M${width-6} 12V274" stroke="#fff" opacity=".22" stroke-width="2"/>
          ${[ [7,8],[width-8,8],[7,276],[width-8,276] ].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="2" fill="${ink}" stroke="none"/>`).join('')}
        </g>
        <g transform="matrix(1 -.4815 0 1 280 170)">
          <rect x="91" y="269" width="26" height="24" rx="7" fill="${ink}"/>
          <rect width="135" height="285" rx="8" fill="${frame}"/>
          <rect x="13" y="36" width="109" height="230" rx="5" fill="${panel}"/>
          <rect x="13" y="36" width="109" height="230" rx="5" fill="url(#${meshId})" stroke="none"/>
          <circle cx="99" cy="19" r="5" fill="${panel}"/>
          <path d="M22 18H36 M44 18H58" stroke="${ink}" stroke-width="3.5"/>
          ${frontFans>0?fan(67.5,96,43,ink,panel):''}
          ${frontFans>1?fan(67.5,206,43,ink,panel):''}
          <path d="M7 10V273" stroke="#fff" opacity=".25" stroke-width="2"/>
        </g>
      </g>
      ${extra?`<g transform="matrix(1 .325 1 -.4815 ${left} ${top})">${Array.from({length:Math.min(extra,2)},(_,i)=>fan(extra===1?width/2:(i===0?width*.27:width*.73),67,36,ink,panel)).join('')}</g>`:''}
    </svg>`;
  }
