import json,re,sys,fitz,unicodedata
from pathlib import Path
root=Path(__file__).resolve().parents[2]; data=json.loads((root/'src/data/gpnSamples.json').read_text());photos=json.load(open(root/'docs/gpn/photo-manifest.json'));audio=json.load(open(root/'docs/gpn/audio-manifest.json'))
write='''Cattle grazing and resting in a fenced green pasture with trees under a cloudy sky.
A rural dirt road with a raised striped barrier, vegetation and a blue sky.
A person crouching on a sidewalk covered with red fallen flowers, beside a wall, flowering tree and parked car.
A person sitting in a branching tree over turquoise rocky water in sunlight.
A person in a hammock among tall palm trees on tropical sand.
A red and white waterfront house and dock reflected in calm water beneath a blue, cloudy sky.
A cyclist on a paved park path with green grass, bare trees and dramatic clouds.
Hikers on a rocky wooded mountain trail with a snowy peak behind them.
The dark silhouette of a person in a coat beside the ocean at sunset.
Two black and white lambs on a grassy slope with bare hills behind them.
An aerial view of a city, fields and a river beneath scattered clouds.
A blue cargo barge beside a riverbank with tall city buildings.
People in a river near the bank, with a bridge and city beyond.
White cafe tables and chairs, an umbrella and flowers on a terrace.
An overhead view of outdoor cafe tables and chairs on brick paving with customers.
An ornate tiled traditional roof with a white pagoda behind it.
People and sellers in a narrow street with tables, plants and colorful shutters.
Two silhouetted people on a footbridge at sunset, framed by trees and buildings.
A narrow canal between old buildings with stone steps and an overhanging willow.
A busy outdoor cafe under a broad leafy tree, with green umbrellas and wicker chairs.
A red tiered traditional tower framed by tree branches.
A still lake reflecting the sky and a long low building or pier spanning the water.
A plant and flower shop crowded with potted greenery, baskets and people.
People on a narrow rocky path between trees and cliffs.
A field of yellow flowers with forest, mountains and a blue sky.
A lone walker on a wet beach with a reflection in the sand beneath a gray sky.
A person leaning into a boat on a shallow shore in warm sunset light.
A large metal horse-head sculpture against a pale sky.
A lake reflecting low clouds and hills, with small buildings on the shoreline.
A large pale yellow house across water, with forest and mountains behind.
Skyscrapers under construction with cranes against a gray sky.
A helmeted worker inside a cylindrical reinforcing metal cage in an excavation.
A tall white curved corner building with rows of windows, framed by trees.
A golden brown monkey gripping a branch in a leafy forest.
A person walking at the far right of a broad bright hall with columns and a reflective floor.
A modern building complex reflected in a long rectangular pool lined with trees.
Tall branching interior columns in an atrium with an illuminated ceiling and balconies.
A view looking up between tall city buildings toward blue sky and a central pole or sculpture.
An orange sunset over a calm lake with silhouetted shoreline trees.
A cargo boat on a river bend between wooded rocky hills.'''.splitlines()
speak='''A low wooden stilt building with a pitched roof amid scrub-covered hills.
A collection of vintage pink and green rotary telephones, a wooden radio and instruments.
Railway tracks curving beside an ocean coast with foamy waves under blue sky.
Colorful hanging lanterns beside an old ochre building covered in ivy.
People at a lit wooden market stall with a BACOWKA sign.
A large brown bird standing on a concrete post with leaves and blurred buildings behind.
Cows in a dusty field with forested hills beneath a gray sky.
A spotted deer surrounded by green foliage.
The Statue of Liberty silhouetted against an orange sunset.
A beach vendor pushing a wheeled rack of white clothes across sand beside the ocean.
A tan dog lying on a path beside a flowerbed and wooden fence.
A man wearing a cap playing guitar and harmonica outdoors.
A harnessed worker suspended in scaffolding against a wall at a construction site.
A man sitting and eating beside a bronze statue on a bench.
Green plants on a forest floor with sunlit tree trunks behind them.
A clear chunk of ice on a black sand beach with foamy waves and a gray sky.
A single delicate dried flower in a narrow glass vase against a dark background.
A pink flower blooming on a round spiny cactus in a pot.
A pale peach and yellow church with twin towers beneath a blue cloudy sky.
Turquoise and yellow buildings projecting over supports.
Small evergreen trees in a golden field with patches of snow on a winter hillside.
A weathered green shutter opened beside a dark window in a rough pale wall.
Adjoining turquoise, yellow and blue facades with a clay tile roof and shadows.
An ornate urban corner building with several floors, dormer windows and pedestrians.
Pedestrians on a broad riverside promenade with an arched bridge in the distance.
A semicircular white bandshell stage in a park with trees and benches.
A plain gray rectangular building behind grass and a soccer goal.
Curving railway tracks between empty station platforms with covered roofs.
Repeated balconies on a cream, red and blue high-rise building beneath a blue sky.
An ornate colorful Hindu temple entrance with painted columns and sculptures.
A black and white interior with an armchair, stool, lamp, curtains and a pool of light.
The Milky Way and stars above a rocky mountain landscape at night.
A snowy forest clearing with small houses and a mountain beyond the clouds.
A close view of pink blossoms on a branch against a blurred pale background.
A person with an umbrella crossing an arched garden footbridge beside manicured trees and a pond.
A weathered green and pink balustrade with climbing branches and flowers.
A black and white view of tree trunks and shaded park paths with sunlight beyond.
A worker in a high-visibility vest behind a small service window in a gray doorway.
A small tan dog asleep on a couch curled against a cushion.
A view between two modern buildings with repeated deep angular facades and windows.'''.splitlines()
for bank,group,alts in [('photos','write',write),('speakingPhotos','speak',speak)]:
 assert len(alts)==40
 data[bank]=[{**p,'alt':alts[i]} for i,p in enumerate(photos[group])]
for bank in ['listenType','listenThenSpeak']:
 for p in data[bank]:
  a=next(a for a in audio if a.get('section')==bank and a.get('number')==p['number'])
  p['audio']=a['file'];p['audioSource']=a['url']
# Scored answers are section examples, not answers for every open-ended question.
pdf=fitz.open(sys.argv[1] if len(sys.argv)>1 else root/'public/gpn-booklet.pdf')
text='\n'.join(unicodedata.normalize('NFKC',pdf[n-1].get_text(sort=True)) for n in range(190,194))
text=re.sub(r'(?m)^\s*(?:Sample Questions|18[6-9])\s*$','',text)
headers=list(re.finditer(r'(?m)^\s*([A-Z ]+): SCORED SAMPLE ANSWER\s*$',text));models=[]
for i,m in enumerate(headers):
 body=text[m.end():headers[i+1].start() if i+1<len(headers) else len(text)]
 # Read Then Speak comments end at the next section transcript heading.
 body=body.split('LISTEN THEN SPEAK: QUESTIONS')[0]
 section=m[1].strip(); model={'section':section,'text':body.strip()}
 if section in ['SPEAK ABOUT THE PHOTO','READ THEN SPEAK','LISTEN THEN SPEAK']:
  page={'SPEAK ABOUT THE PHOTO':190,'READ THEN SPEAK':191,'LISTEN THEN SPEAK':193}[section]
  model['audio']=next(a['file'] for a in audio if a.get('page')==page and a.get('section') not in ['listenType','listenThenSpeak'])
 if section=='WRITE ABOUT THE PHOTO':model['photo']=data['photos'][5]['img']
 if section=='SPEAK ABOUT THE PHOTO':model['photo']=data['speakingPhotos'][12]['img']
 models.append(model)
data['scoredExamples']=models
(root/'src/data/gpnSamples.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
print('Models',[(m['section'],len(m['text'])) for m in models]); print('Audio',data['listenType'][0]['audio'])
