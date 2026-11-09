const plural=(n,lang,forms)=>forms[new Intl.PluralRules(lang==='uk'?'uk':'ru').select(n)] ?? forms.other;
export function distanceText(feet,lang='ru'){
  const f=new Intl.NumberFormat(lang==='uk'?'uk-UA':'ru-RU',{maximumFractionDigits:1});let n,unit;
  if(feet>=5280){n=Math.round(feet/5280*100)/100;unit=plural(n,lang,lang==='uk'?{one:'миля',few:'милі',many:'миль',other:'милі'}:{one:'миля',few:'мили',many:'миль',other:'мили'});}
  else if(feet>=300){n=Math.round(feet/3);unit=plural(n,lang,lang==='uk'?{one:'ярд',few:'ярди',many:'ярдів',other:'ярда'}:{one:'ярд',few:'ярда',many:'ярдов',other:'ярда'});}
  else{n=Math.round(feet);unit=plural(n,lang,lang==='uk'?{one:'фут',few:'фути',many:'футів',other:'фута'}:{one:'фут',few:'фута',many:'футов',other:'фута'});}
  const meters=feet*.3048;return f.format(n)+' '+unit+' · '+f.format(meters>=1000?meters/1000:meters)+' '+(meters>=1000?'км':'м');
}
export function walkingText(feet,speed,lang='ru'){
  const seconds=Math.round(feet/speed*60),hours=Math.floor(seconds/3600),minutes=Math.floor(seconds%3600/60),rest=seconds%60;
  return (lang==='uk'?'Пішки: ':'Пешком: ')+(hours?hours+' '+(lang==='uk'?'год':'ч')+' '+minutes+' '+(lang==='uk'?'хв':'мин'):minutes?minutes+' '+(lang==='uk'?'хв':'мин')+(rest?' '+rest+' с':''):rest+' с');
}
