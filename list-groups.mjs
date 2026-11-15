// Presentation groups do not change document categories, IDs or permissions.
export const listGroups=[
 ['administration','Власть и городские учреждения','Влада та міські установи'],
 ['districts','Районы и городские территории','Райони та міські території'],
 ['temples','Храмы и святилища','Храми та святині'],
 ['inns','Таверны, гостиницы и развлечения','Таверни, готелі та розваги'],
 ['shops','Торговля и мастерские','Торгівля та майстерні'],
 ['knowledge','Знания, магия и обучение','Знання, магія та навчання'],
 ['services','Городские услуги','Міські послуги'],
 ['roads','Улицы, площади и мосты','Вулиці, площі та мости'],
 ['nature','Водоёмы и природные места','Водойми та природні місця'],
 ['burial','Кладбища и гробницы','Кладовища та гробниці'],
 ['landmarks','Достопримечательности, крепости и руины','Пам’ятки, фортеці та руїни']
];
const overrides={administration:['castle','justice','merchant-guild'],knowledge:['knowledge','archives','starshine','neverwinter-academy','magic-academy','cloak'],roads:['sleeping-dragon','dolphin','wyvern','merchant-square','blackule-lane','deekin-street','coriol-street','tymor-street'],burial:['neverdeath','paupers','waterclock'],districts:['fisher','mask-earthmote']};
export function listGroup(place){
 if(listGroups.some(([key])=>key===place.listGroup))return place.listGroup;
 for(const [group,ids] of Object.entries(overrides))if(ids.includes(place.id))return group;
 return {district:'districts',temple:'temples',inn:'inns',shop:'shops',service:'services',water:'nature'}[place.category] ?? 'landmarks';
}
export function groupedPlaces(places,language='ru'){
 const collator=new Intl.Collator(language,{sensitivity:'base',numeric:true,ignorePunctuation:true});
 return listGroups.map(([id,ru,uk])=>({id,title:language==='uk'?uk:ru,places:places.filter(place=>listGroup(place)===id).sort((a,b)=>collator.compare(a[language]?.name ?? a.en ?? '',b[language]?.name ?? b.en ?? '') || a.id.localeCompare(b.id))})).filter(group=>group.places.length);
}
