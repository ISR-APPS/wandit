/* Concrete, self-contained SVG scenes. Every scene has four stable visual states. */
(() => {
  'use strict';
  const C = { ink: '#25362d', paper: '#f4f1e8', cream: '#fffcf5', green: '#b5caaa', gold: '#e1c68f', light: '#dfe5d6', faint: '#e6e1d5', dim: '#7c897b' };
  let serial = 0;
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]);
  const rect = (x,y,w,h,fill=C.cream,r=12,extra='') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" ${extra}/>`;
  const circle = (x,y,r,fill=C.cream,extra='') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" ${extra}/>`;
  const line = (x1,y1,x2,y2,extra='') => `<path d="M${x1} ${y1}L${x2} ${y2}" fill="none" ${extra}/>`;
  const path = (d,fill='none',extra='') => `<path d="${d}" fill="${fill}" ${extra}/>`;
  const group = (x,y,body,opacity=1) => `<g transform="translate(${x} ${y})" opacity="${opacity}">${body}</g>`;
  const label = (text,x,y=416,size=28,anchor='middle',fill=C.ink) => `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="${fill}" stroke="none" font-size="${size}" font-weight="600">${esc(text)}</text>`;
  const smallLabel = (text,x,y) => label(text,x,y,28);
  const base = (y=372) => line(55,y,745,y,`stroke="${C.faint}"`);
  const halo = (x,y,rx=90,ry=90) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${C.green}" stroke="none" opacity=".27"/>`;
  const foot = (x,y,w=100) => `<ellipse cx="${x}" cy="${y}" rx="${w}" ry="10" fill="${C.ink}" stroke="none" opacity=".08"/>`;
  const check = (x,y,color=C.ink) => path(`M${x-10} ${y}l7 7 14-16`,'none',`stroke="${color}" stroke-width="4"`);
  const spark = (x,y) => line(x-9,y,x+9,y)+line(x,y-9,x,y+9);
  const bars = (x,y,w=70,count=3,color=C.faint) => Array.from({length:count},(_,i)=>rect(x,y+i*17,w-(i%2)*w*.25,6,color,3,'stroke="none"')).join('');
  const paper = (x,y,w=82,h=104,fill=C.cream,kind='lines') => group(x,y,
    path(`M0 0H${w-22}L${w} 22V${h}H0Z`,fill)+path(`M${w-22} 0V22H${w}`)+
    (kind==='code' ? path(`M25 43l-11 12 11 12M${w-25} 43l11 12-11 12M${w/2+4} 40l-8 31`):bars(15,42,w-30,3)));
  const folder = (x,y,w=160,h=124,fill=C.gold,files=0) => group(x,y,
    path(`M0 20V0h${w*.42}l15 20H${w}v${h-20}H0Z`,fill)+
    (files ? paper(22,-32,64,85,C.cream,'code')+paper(73,-18,61,80,C.cream) : '')+
    path(`M0 43Q0 34 12 34H${w-12}Q${w} 34 ${w} 46v${h-46}H0Z`,fill)+
    rect(w*.4,h*.62,w*.2,7,C.ink,3,'stroke="none"'));
  const browser = (x,y,w=230,h=190,opts={}) => w<140||h<130 ? `<g transform="translate(${x} ${y}) scale(${w/200} ${h/180})">${browser(0,0,200,180,opts)}</g>` : group(x,y,
    rect(6,8,w,h,C.faint,15,'stroke="none"')+rect(0,0,w,h,opts.fill||C.cream,15)+line(0,34,w,34)+
    [15,29,43].map(cx=>circle(cx,17,3,C.ink,'stroke="none"')).join('')+
    rect(65,12,w-88,10,C.faint,5,'stroke="none"')+
    (opts.empty ? bars(24,63,w-48,4) : opts.error ? circle(w/2,97,29,C.gold)+line(w/2,82,w/2,100)+circle(w/2,110,2,C.ink)+bars(40,145,w-80,2) :
    rect(20,54,w*.38,h-78,opts.active?C.green:C.faint,7,'stroke="none"')+
    path(`M30 ${h-47}q15-45 36-24q15-32 ${w*.38-20}-21`,'none',`stroke="${C.ink}"`)+
    circle(42,77,9,C.gold,'stroke="none"')+bars(w*.51,61,w*.36,3)+rect(w*.51,h-62,w*.32,24,opts.active?C.green:C.faint,7,'stroke="none"')));
  const robot = (x,y,scale=1,awake=true,holding=false) => `<g transform="translate(${x} ${y}) scale(${scale})">`+
    line(44,-13,44,0)+circle(44,-18,5,awake?C.gold:C.faint)+rect(0,0,88,69,awake?C.green:C.faint,22)+
    rect(13,19,62,30,C.ink,12,'stroke="none"')+
    (awake ? circle(30,33,4,C.cream,'stroke="none"')+circle(58,33,4,C.cream,'stroke="none"') : line(24,33,35,33,`stroke="${C.cream}"`)+line(53,33,64,33,`stroke="${C.cream}"`))+
    rect(14,76,60,61,C.cream,15)+circle(44,99,8,awake?C.gold:C.faint)+
    path(holding?'M15 92L-8 117L-28 97':'M15 91L-9 118M73 91L96 117')+
    line(28,137,22,156)+line(60,137,66,156)+line(12,157,30,157)+line(59,157,77,157)+'</g>';
  const server = (x,y,w=126,h=212,active=true) => group(x,y,
    rect(5,8,w,h,C.faint,12,'stroke="none"')+rect(0,0,w,h,C.cream,12)+
    [22,82,142].map((top,i)=>rect(12,top,w-24,47,i===1&&active?C.green:C.paper,7)+circle(25,top+23,4,active?C.ink:C.faint,'stroke="none"')+bars(40,top+15,w-57,2,C.dim)).join(''));
  const coin = (x,y,r=25) => circle(x,y,r,C.gold)+circle(x,y,r-7,C.gold)+line(x,y-r*.4,x,y+r*.4);
  const coins = (x,y,n=3) => Array.from({length:n},(_,i)=>rect(x,y-i*12,72,18,C.gold,9)).join('')+`<ellipse cx="${x+36}" cy="${y-(n-1)*12}" rx="36" ry="10" fill="${C.gold}"/>`;
  const lock = (x,y,open=false,scale=1) => `<g transform="translate(${x} ${y}) scale(${scale})">`+path(open?'M16 23V9q0-20 22-20q22 0 22 20':'M16 23V9q0-23 22-23q22 0 22 23v14')+rect(0,23,76,59,C.gold,10)+circle(38,46,6,C.ink,'stroke="none"')+line(38,52,38,62)+'</g>';
  const key = (x,y,scale=1) => `<g transform="translate(${x} ${y}) scale(${scale})">`+circle(0,0,23,C.gold)+circle(0,0,9,C.cream)+path('M22-7h66v14H75v15H59V7H22Z',C.gold)+'</g>';
  const database = (x,y,w=130,h=150,active=true) => group(x,y,
    path(`M0 20v${h-40}a${w/2} 20 0 0 0 ${w} 0V20`,active?C.green:C.cream)+
    `<ellipse cx="${w/2}" cy="20" rx="${w/2}" ry="20" fill="${active?C.green:C.cream}"/>`+
    path(`M0 ${h*.43}a${w/2} 20 0 0 0 ${w} 0M0 ${h*.7}a${w/2} 20 0 0 0 ${w} 0`));
  const table = (x,y,w=264,h=120) => group(x,y,rect(0,0,w,h,C.cream,8)+rect(0,0,w,34,C.green,8)+line(0,34,w,34)+line(w*.37,0,w*.37,h)+line(w*.71,0,w*.71,h)+line(0,64,w,64)+line(0,94,w,94)+bars(12,47,w*.24,3));
  const phone = (x,y,w=105,h=205,active=true,qr=false) => group(x,y,rect(4,6,w,h,C.faint,22,'stroke="none"')+rect(0,0,w,h,C.cream,22)+rect(w*.3,9,w*.4,8,C.ink,4,'stroke="none"')+
    (qr ? [[20,55],[61,55],[20,98]].map(([px,py])=>rect(px,py,26,26,C.ink,2,'stroke="none"')+rect(px+6,py+6,14,14,C.cream,0,'stroke="none"')).join('')+rect(61,98,11,11,C.ink,0,'stroke="none"')+rect(78,98,9,23,C.ink,0,'stroke="none"')+rect(61,114,11,11,C.ink,0,'stroke="none"') : rect(13,38,w-26,84,active?C.green:C.faint,10,'stroke="none"')+circle(w/2,74,18,C.gold,'stroke="none"')+bars(17,141,w-34,2)+rect(17,178,w-34,12,active?C.green:C.faint,5,'stroke="none"'))+line(w*.35,h-8,w*.65,h-8));
  const bench = (x,y,w=310) => group(x,y,rect(0,0,w,17,C.gold,5)+line(22,17,22,74)+line(w-22,17,w-22,74)+line(22,55,w-22,55));
  const gate = (x,y,w=98,h=205,open=true) => group(x,y,
    rect(0,0,15,h,C.ink,3,'stroke="none"')+rect(w-15,0,15,h,C.ink,3,'stroke="none"')+rect(0,0,w,16,C.ink,3,'stroke="none"')+
    (open ? path(`M17 16L${w-34} 34v${h-32}L17 ${h-5}Z`,C.green) : rect(17,17,w-34,h-22,C.gold,2))+
    circle(open?w-43:w-37,h/2,4,C.ink,'stroke="none"'));
  const receipt = (x,y,w=155,h=205,final=false) => group(x,y,
    path(`M0 0H${w}V${h}l-13-10-13 10-13-10-13 10-13-10-13 10-13-10-13 10-13-10-13 10-12-10-12 10Z`,C.cream)+bars(20,25,w-40,4)+line(20,109,w-20,109)+rect(20,126,w-40,44,final?C.green:C.gold,8,'stroke="none"')+(final?check(w/2,149):bars(36,143,w-72,1,C.ink)));
  const progress = (x,y,w=180,value=1) => rect(x,y,w,14,C.faint,7,'stroke="none"')+rect(x,y,w*Math.max(.04,value),14,C.green,7,'stroke="none"');
  const scenes = {};

  scenes.evolution = s => base()+halo([139,391,638,391][s],225,s===0?95:123,128)+
    group(59,169,path('M0 0h152q16 0 16 16v88q0 16-16 16H47L17 147v-27H0q-16 0-16-16V16Q-16 0 0 0Z',C.cream)+bars(8,28,132,4))+
    group(0,0,s===3?folder(305,201,176,142,C.gold,2):paper(342,133,107,175,s===1?C.green:C.cream,'code'),s>0?1:.48)+
    group(0,0,browser(524,125,229,217,{active:s>=2,empty:s<2}),s>1?1:.48)+
    (s===1?group(420,271,robot(0,0,.45,true,true)):'')+
    label('Request',141)+label(s===3?'Project files':'One HTML file',391)+label(s===3?'Live preview':'Page preview',641);

  scenes.foundation = s => base()+
    rect(80,319,640,49,C.gold,9)+line(285,320,285,368)+line(505,320,505,368)+
    [165,380,595].map((x,i)=>rect(x,219,50,99,(s===0||s===2)?C.green:C.cream,3)+rect(x-12,208,74,14,C.cream,3)+rect(x-12,306,74,13,C.cream,3)).join('')+
    (s>0?halo(400,152,230,113):'')+
    group(0,0,rect(137,173,526,35,C.cream,7)+path('M210 173V89H590v84',C.cream,s===3?'stroke-dasharray="8 7"':'')+path('M182 89L400 36L618 89Z',s===3?C.paper:C.green,s===3?'stroke-dasharray="8 7"':'')+
      bars(325,114,150,1),s>0?1:.48)+
    (s===2?group(654,257,path('M0 0l13 13-34 34-13-13Z',C.gold)+circle(-28,41,4,C.cream)):'')+
    label(s===3?'Proposed builder':'New builder',400,154)+label('Login',190)+label('Credits',405)+label('Domains',620);

  scenes.harness = s => base()+halo(s===0?169:493,213,s===0?95:239,140)+
    (s>=2?rect(285,73,445,295,C.cream,16)+label(s===3?'One harness path':'Sandbox',507,108,28):'')+
    group(0,0,robot(94,155,1.5,true,s>1),1)+
    group(0,0,bench(303,299,410),s>0?1:.48)+
    group(0,0,rect(322,151,180,122,C.cream,10)+line(322,186,502,186)+paper(344,207,51,68,C.cream,'code')+paper(413,207,51,68,s===2?C.green:C.cream,'code'),s>0?1:.48)+
    group(0,0,browser(530,145,164,143,{empty:true})+path('M550 214l10 10-10 10M578 234h30'),s>0?1:.48)+
    (s===3?rect(550,250,121,15,C.green,6,'stroke="none"')+check(684,136):'')+
    label('AI model',158)+label('File tools',405)+label('Commands',622)+
    (s===0?group(220,98,circle(0,0,18,C.gold)+circle(26,-18,9,C.gold)+circle(39,-43,5,C.gold)):'');

  scenes.workshop = s => base()+halo(393,218,242,147)+
    rect(131,71,538,291,C.cream,13)+rect(131,71,538,38,C.green,13)+line(131,109,669,109)+
    label(s===2?'Asleep':s===3?'Restarted':'Private machine',400,99,28)+
    bench(165,296,322)+robot(205,145,.91,s!==2)+
    group(335,181,paper(0,0,85,107,s===1?C.green:C.cream,'code'))+
    server(516,139,113,206,s!==2)+
    (s===1?circle(572,304,19,C.green)+check(572,304):'')+
    (s===2?path('M285 154q-24 1-24-22q-21 29 12 35q6-1 12-13Z',C.gold):'')+
    (s===3?circle(572,304,19,C.green)+check(572,304):'')+
    label('Work area',303)+label('Saved disk',574);

  scenes.relay = s => base()+halo([151,402,635,152][s],218,s===2?116:125,130)+
    browser(45,133,211,190,{active:s===3,empty:s<3})+
    group(0,0,server(328,127,139,226,s>0),s>0?1:.48)+
    group(0,0,rect(542,131,198,227,C.cream,12)+rect(559,155,164,35,C.green,6)+
      [219,250,281].map((y,i)=>circle(569,y,5,s>=2?C.green:C.faint,'stroke="none"')+bars(585,y-3,120-i*12,1)).join('')+
      progress(559,322,164,s===3?1:.62),s>=2?1:.48)+
    (s===0?group(200,258,lock(0,0,true,.55)):'')+
    (s===2?lock(471,43,false,.6):'')+
    (s===3?rect(57,177,187,111,C.green,9,'stroke="none"')+check(151,230)+path('M77 149l10 10M87 149l-10 10'):'')+
    label('Browser',151)+label('Trigger.dev',398)+label('Redis',640);

  scenes.preview = s => base()+halo([144,387,631,631][s],222,s<2?101:141,133)+
    server(84,126,130,219,true)+
    group(0,0,gate(341,129,97,217,s>0),s>0?1:.48)+
    group(0,0,browser(501,111,251,233,{active:s===2,error:s===3,empty:s<2}),s>=1?1:.48)+
    (s===3?group(439,291,robot(0,0,.46,true,true)):'')+
    label('Dev server',151)+label('Proxy',390)+label('Your preview',626);

  scenes.backend = s => base()+halo([155,523,523,537][s],221,s===0?118:187,142)+
    browser(41,123,223,211,{active:true})+
    group(0,0,rect(348,86,387,278,C.cream,13)+path('M348 126H735')+
      label('Separate backend',542,115)+database(395,155,116,135,true)+
      (s>=2?table(535,164,165,109):lock(572,178,false,.7))+
      (s===3?rect(369,309,345,37,C.green,7)+circle(393,327,7,C.cream)+circle(425,327,7,C.cream)+circle(457,327,7,C.cream)+bars(488,324,204,1,C.ink):''),s>0?1:.48)+
    (s===0?group(131,185,lock(0,0,false,.58)):'')+
    label('Generated app',153)+label(s===3?'Cloud tab controls':'Login + stored data',541);

  scenes.mobile = s => base()+halo([155,155,400,641][s],220,s===3?134:115,134)+
    browser(37,133,231,200,{active:s===1,empty:s===0})+
    (s===0?folder(98,214,105,87,C.gold,1):'')+
    group(0,0,phone(344,118,107,220,true,s===1),s>0?1:.48)+
    group(0,0,rect(538,82,207,262,C.cream,15)+rect(547,93,189,20,C.faint,6,'stroke="none"')+phone(593,126,96,200,s===3,false),s===3?1:.48)+
    (s===3?group(542,279,rect(0,0,191,68,C.gold,8)+path('M84 0v68M107 0v68')+check(152,35)):'')+
    label(s===0?'Expo project':'Web preview',152)+label(s===2?'Preview app':'Your phone',400)+label(s===3?'Device + EAS':'Hosted device',643);

  scenes.versions = s => base()+halo([143,391,391,391][s],225,122,135)+
    folder(64,210,159,128,C.gold,s>0?2:0)+
    group(0,0,rect(296,109,189,253,C.cream,12)+
      [129,201,273].map((y,i)=>rect(312,y,157,58,(s===3&&i===0)||(s===1&&i===2)?C.green:C.paper,7)+rect(369,y+13,43,7,C.ink,3,'stroke="none"')+line(378,y+31,402,y+31)).join(''),s>0?1:.48)+
    database(590,187,138,154,true)+
    (s===0?paper(115,110,79,109,C.cream,'code'):'')+
    (s===2?group(350,70,rect(0,0,84,45,C.gold,7)+check(42,22)):'')+
    (s===3?check(389,156)+circle(660,134,20,C.green)+check(660,134):'')+
    label('Project code',143)+label(s===2?'R2 code history':'Saved versions',391)+label('App data',660);

  scenes.publish = s => base()+halo([141,387,390,637][s],221,s===3?125:109,133)+
    group(62,167,path('M0 31L79 0l79 31v124l-79 32L0 155Z',s===0?C.green:C.gold)+path('M0 31l79 33 79-33M79 64v123M39 16l80 32v40l-22 9V57Z',C.gold))+
    group(0,0,rect(306,116,165,248,C.cream,10)+rect(321,138,135,64,C.green,7)+folder(321,225,135,107,C.gold,1),s>0?1:.48)+
    group(0,0,browser(520,131,235,218,{active:s===3,empty:s<3}),s>1?1:.48)+
    (s===2?group(334,67,rect(0,0,111,44,C.gold,8)+check(55,22)):'')+
    (s===3?group(709,306,circle(0,0,28,C.green)+path('M-28 0h56M0-28q25 28 0 56q-25-28 0-56M-23-15h46M-23 15h46')):'')+
    label('Built files',141)+label('R2 storage',389)+label('Public app',635);

  scenes.security = s => base()+halo([199,459,664,664][s],218,s===0?151:110,139)+
    rect(65,104,268,260,C.cream,10)+rect(65,104,268,35,C.green,10)+line(65,139,333,139)+
    (s===2?browser(86,166,226,174,{active:true}):robot(154,177,1.03,true))+
    group(0,0,gate(414,133,90,220,true)+key(454,208,.53),s>=1?1:.48)+
    group(0,0,rect(593,175,145,173,C.cream,9)+lock(628,190,false,.94)+
      (s===3?circle(666,312,19,C.green)+check(666,312):s===2?rect(613,301,105,23,C.green,5)+line(647,301,647,324)+line(682,301,682,324):''),s>=2?1:.48)+
    (s===3?group(691,133,circle(0,0,22,C.gold)+rect(-10,-10,20,20,C.ink,3,'stroke="none"')):'')+
    label(s===2?'Preview':'Project wall',198)+label('Key proxy',459)+label(s===3?'Release checks':'App rules',666);

  scenes.money = s => base()+halo([150,405,405,652][s],224,s===3?98:120,133)+
    group(0,0,rect(67,257,170,87,C.cream,14)+path('M67 279h170M202 280v28h35')+coins(93,239,4)+coin(194,191,23))+
    group(0,0,rect(307,98,191,246,C.cream,13)+rect(329,121,147,75,C.ink,9,'stroke="none"')+
      [351,398,445].map((x,i)=>rect(x-13,139,26,39,s>0?C.green:C.faint,4,'stroke="none"')).join('')+
      [221,262,303].map((y,i)=>[348,400,452].map(x=>circle(x,y,9,i===2&&s===2?C.green:C.paper)).join('')).join('')+
      (s===2?circle(484,91,22,C.green)+check(484,91):''),s>0?1:.48)+
    group(0,0,receipt(581,110,151,224,s===3),s===3?1:.48)+
    (s===0?lock(197,241,false,.42):'')+
    label('Credit hold',151)+label(s===2?'Final charge':'AI usage',402)+label('Receipt',655);

  scenes.system = s => base()+halo([96,291,504,691][s],230,s===1?112:91,121)+
    group(46,192,path('M0 0H104q12 0 12 12v76q0 12-12 12H40L18 121v-21H0q-12 0-12-12V12Q-12 0 0 0Z',C.cream)+bars(9,25,72,3))+
    group(0,0,rect(204,130,183,226,C.cream,12)+rect(204,130,183,27,C.green,8)+robot(251,180,.87,true)+bench(219,318,151),s>0?1:.48)+
    group(0,0,browser(419,151,176,179,{active:s>=2,empty:s<2}),s>=2?1:.48)+
    group(0,0,rect(622,142,133,209,C.cream,12)+[162,224,286].map((y,i)=>rect(635,y,107,49,i===2&&s===3?C.green:C.paper,7)+rect(671,y+13,33,6,C.ink,3,'stroke="none"')).join(''),s===3?1:.48)+
    label('Request',101)+label('Workshop',296)+label('Preview',507)+label('Saved version',690)+
    (s===1?group(211,60,rect(0,0,168,45,C.gold,8)+label('Trigger.dev',84,32,28)):'');

  scenes.records = s => base()+halo([173,434,434,638][s],225,s===0?111:126,139)+
    folder(63,200,187,152,C.gold,2)+
    group(0,0,rect(307,79,194,281,C.cream,13)+line(307,124,501,124)+
      [150,203,256].map((y,i)=>rect(324,y,160,40,((s===1&&i===0)||(s===2&&i===1))?C.green:C.paper,7)+circle(345,y+20,5,C.ink,'stroke="none"')+bars(362,y+17,98,1,C.dim)).join('')+
      label('Project ID',404,111,28),1)+
    group(0,0,rect(543,111,199,102,C.cream,10)+database(558,128,56,67)+bars(630,140,92,3)+
      rect(543,237,199,108,C.cream,10)+browser(558,253,68,65,{active:true})+bars(641,266,82,3),s>=2?1:.48)+
    (s===3?lock(692,71,false,.58):'')+
    label('One project',159)+label(s===2?'Code + turn':'Build records',407)+label(s===3?'Protected records':'Linked records',643);

  scenes.rollout = s => base()+
    [95,273,451,629].map((x,i)=>{
      const active = i===s;
      return (active?halo(x+37,208,89,131):'')+rect(x-21,317-i*28,117,50+i*28,active?C.green:C.cream,9)+
        line(x+36,317-i*28,x+36,116-i*8)+path(`M${x+36} ${116-i*8}h69l-17 29 17 29h-69Z`,i<=s?C.gold:C.faint)+
        (i<s?circle(x+37,283-i*28,20,C.green)+check(x+37,283-i*28):active?circle(x+37,278-i*28,24,C.cream)+label(String(i+1),x+37,288-i*28,28):'')+
        label(['P0','P1–2','P3–5','P6–7'][i],x+38,415,28);
    }).join('')+
    (s===0?group(58,264,rect(0,0,37,46,C.cream,5)+path('M10 0v18L2 34h33l-9-16V0')):'');

  scenes.decisions = s => base()+halo([151,151,400,643][s],231,s===0?113:122,129)+
    group(0,0,paper(55,123,114,156,C.cream)+paper(125,178,114,157,s===1?C.green:C.cream)+
      circle(94,166,10,C.green)+circle(163,221,10,C.gold)+(s===1?check(181,294):''))+
    group(0,0,bench(288,296,228)+path('M344 134h61v17h-8v43l37 70q9 23-19 23h-85q-28 0-18-23l40-70v-43h-8Z',C.cream)+
      path('M329 240h88l13 27q4 12-11 12h-84q-15 0-10-12Z',s>=2?C.green:C.faint)+circle(355,224,6,C.gold)+circle(385,245,5,C.cream),s>=2?1:.48)+
    group(0,0,rect(563,111,171,241,C.cream,10)+rect(608,97,81,27,C.gold,7)+
      [165,213,261].map((y,i)=>rect(580,y,24,24,s>=2?C.green:C.paper,5)+(s>=2?check(592,y+12):'')+bars(617,y+8,98-i*10,1,C.dim)).join('')+
      (s===3?circle(721,336,25,C.green)+check(721,336):''),s>=2?1:.48)+
    label(s===1?'Product choice':'Open choices',150)+label('Small trial',402)+label(s===3?'Next tickets':'Evidence',649);

  window.renderIllustration = function renderIllustration(chapter, stepIndex) {
    const step = Math.max(0,Math.min(3,Number(stepIndex)||0));
    const id = `wandit-art-${++serial}`;
    const current = chapter.steps && chapter.steps[step] || {};
    const title = `${chapter.title || 'Wandit V2'}: ${current.title || `Step ${step+1}`}`;
    const desc = current.caption || current.body || 'An illustrated explanation of this step.';
    const draw = scenes[chapter.scene] || scenes.system;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" role="img" aria-labelledby="${id}-title ${id}-desc" style="display:block;width:100%;height:auto;font-family:inherit;overflow:visible"><title id="${id}-title">${esc(title)}</title><desc id="${id}-desc">${esc(desc)}</desc><g stroke="${C.ink}" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round">${draw(step)}</g></svg>`;
  };
})();
