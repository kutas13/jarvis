export type ModelMode='ECONOMY'|'AUTO'|'MAX';

export function modelConfig(){
  return {
    economy: process.env.OPENAI_MODEL_ECONOMY?.trim() || 'gpt-5-mini',
    smart: process.env.OPENAI_MODEL_SMART?.trim() || 'gpt-5.4-mini',
    vision: process.env.OPENAI_MODEL_VISION?.trim() || 'gpt-5.4-mini',
    mode: (process.env.JARVIS_MODEL_MODE?.trim().toUpperCase() || 'AUTO') as ModelMode
  };
}

export function chooseModel(message:string, budgetRatio=0){
  const cfg=modelConfig();
  if(cfg.mode==='ECONOMY' || budgetRatio>=0.8) return cfg.economy;
  if(cfg.mode==='MAX') return cfg.smart;
  const heavy=/derin analiz|ayrıntılı analiz|karşılaştır|strateji|kod yaz|debug|hata ayıkla|karmaşık|uzun plan|ekranı analiz|görseli analiz/i.test(message) || message.length>1200;
  return heavy ? cfg.smart : cfg.economy;
}

function ratesFor(model:string){
  const cfg=modelConfig();
  if(model===cfg.smart || model===cfg.vision){
    return {
      input:Number(process.env.OPENAI_SMART_INPUT_USD_PER_MTOK||0.75),
      output:Number(process.env.OPENAI_SMART_OUTPUT_USD_PER_MTOK||4.5)
    };
  }
  return {
    input:Number(process.env.OPENAI_ECONOMY_INPUT_USD_PER_MTOK||0.25),
    output:Number(process.env.OPENAI_ECONOMY_OUTPUT_USD_PER_MTOK||2)
  };
}

export function estimateCost(model:string, usage:any){
  const input=Number(usage?.input_tokens||0), output=Number(usage?.output_tokens||0);
  const r=ratesFor(model);
  return {input,output,total:Number(usage?.total_tokens||input+output),cost:(input/1e6)*r.input+(output/1e6)*r.output};
}
