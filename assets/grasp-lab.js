'use strict';
// These controls explain a fixed architecture; they do not run either model.
document.querySelectorAll('[data-switch]').forEach(group=>{
  const buttons=Array.from(group.querySelectorAll('button[data-target]'));
  buttons.forEach(button=>button.addEventListener('click',()=>{
    buttons.forEach(b=>{
      const active=b===button;
      b.setAttribute('aria-pressed',String(active));
      const panel=document.getElementById(b.dataset.target);
      if(panel) panel.hidden=!active;
    });
  }));
});
const scaleSelect=document.getElementById('model-scale');
if(scaleSelect){
  const scales={small:[4,4,256,'128 → 64'],medium:[8,6,384,'256 → 128'],default:[8,12,768,'512 → 256 → 128'],large:[12,24,1536,'512 → 256 → 128']};
  const update=()=>{
    const [layers,heads,width,output]=scales[scaleSelect.value];
    document.getElementById('scale-summary').textContent=`${layers} 层 ×（OR → ER → RR）；${heads} 个头 × ${width/heads} 维；节点与边均为 ${width} 维。输出 MLP 隐藏层：${output}。`;
    document.getElementById('scale-wide').textContent=`初始 + ${layers} 层特征 → ${(layers+1)*width} → ${width} 维`;
  };
  scaleSelect.addEventListener('change',update);update();
}
