// Explicit live test: node --env-file=.env.local scripts/test-caption-variety.mjs
// Five small real PNG requests to Gemini; no uploads, database writes, or key logs.
import { deflateSync } from 'node:zlib';
import { gemini } from '../tests/helpers/gemini.mjs';

function png(scene) {
  const width = 320, height = 240;
  const pixels = Buffer.alloc(width * height * 3, 238);
  function point(x, y, color) {
    if (x >= 0 && x < width && y >= 0 && y < height) pixels.set(color, (Math.floor(y) * width + Math.floor(x)) * 3);
  }
  function rect(x, y, w, h, color) { for (let yy=y; yy<y+h; yy++) for (let xx=x; xx<x+w; xx++) point(xx,yy,color); }
  function oval(cx, cy, rx, ry, color) {
    for (let y=Math.max(0,cy-ry); y<=Math.min(height-1,cy+ry); y++) for (let x=Math.max(0,cx-rx); x<=Math.min(width-1,cx+rx); x++) if (((x-cx)/rx)**2+((y-cy)/ry)**2<=1) point(x,y,color);
  }
  function line(x1,y1,x2,y2,color,thickness=2) {
    const steps=Math.max(Math.abs(x2-x1),Math.abs(y2-y1));
    for(let i=0;i<=steps;i++) rect(Math.round(x1+(x2-x1)*i/steps),Math.round(y1+(y2-y1)*i/steps),thickness,thickness,color);
  }
  if (scene==='taxi') {
    rect(0,0,320,180,[173,200,215]); rect(0,180,320,60,[95,101,107]);
    for(let x=5;x<320;x+=60) { rect(x,35,45,145,[125,134,142]); for(let y=45;y<170;y+=22) rect(x+10,y,8,10,[224,228,206]); }
    rect(45,135,230,55,[243,193,39]); rect(90,100,135,40,[243,193,39]); rect(105,108,45,30,[89,132,157]); rect(160,108,48,30,[89,132,157]);
    oval(90,188,21,21,[30,32,35]); oval(235,188,21,21,[30,32,35]); rect(142,89,32,11,[250,246,217]);
  } else if (scene==='bagel') {
    oval(160,135,126,81,[210,218,229]); oval(160,125,94,65,[193,130,64]); oval(160,120,75,45,[216,158,85]); oval(160,119,26,20,[210,218,229]);
    for(const [x,y] of [[100,105],[121,89],[201,109],[212,140],[150,158],[111,139]]) line(x,y,x+3,y+2,[117,74,38],2);
  } else if (scene==='plant') {
    rect(0,200,320,40,[163,139,114]); rect(118,150,85,60,[171,89,56]); rect(110,146,100,14,[192,106,68]);
    line(160,147,191,45,[63,109,62],6); oval(177,99,34,12,[79,130,67]); oval(208,69,33,14,[87,141,69]); oval(176,50,26,12,[65,120,63]);
  } else if (scene==='umbrella') {
    rect(0,0,320,240,[171,187,199]);
    for(let x=10;x<320;x+=30) { line(x,15,x-9,52,[94,135,169]); line(x+9,110,x,148,[94,135,169]); }
    // Clearly inverted canopy, with tips higher than its center.
    line(70,67,111,93,[177,53,115],8); line(111,93,160,110,[177,53,115],8); line(160,110,208,93,[177,53,115],8); line(208,93,250,67,[177,53,115],8);
    line(160,108,160,210,[58,62,72],4); oval(168,210,10,9,[58,62,72]);
  } else {
    rect(70,150,180,29,[134,77,58]); rect(82,157,150,15,[238,221,184]);
    rect(80,116,158,29,[53,92,126]); rect(91,122,137,15,[238,221,184]);
    rect(62,83,185,29,[80,108,71]); rect(74,89,163,15,[238,221,184]);
  }
  function chunk(type,data) {
    const payload=Buffer.concat([Buffer.from(type),data]); let crc=0xffffffff;
    for(const byte of payload) { crc^=byte; for(let i=0;i<8;i++) crc=(crc>>>1)^((crc&1)?0xedb88320:0); }
    const size=Buffer.alloc(4),check=Buffer.alloc(4); size.writeUInt32BE(data.length); check.writeUInt32BE((crc^0xffffffff)>>>0);
    return Buffer.concat([size,payload,check]);
  }
  const header=Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height,4); header[8]=8;header[9]=2;
  const rows=Buffer.alloc(height*(width*3+1));
  for(let y=0;y<height;y++) pixels.copy(rows,y*(width*3+1)+1,y*width*3,(y+1)*width*3);
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);
}
const cases = [
  ['taxi', 'A taxi rolled past just as I finally reached the curb. First month in NYC.'],
  ['bagel', 'Paid $9 for this plain bagel. No toppings.'],
  ['plant', 'Bought a dorm plant last week. It is leaning away from my desk.'],
  ['umbrella', 'My umbrella inverted the second I stepped outside. Trying to reach the subway.'],
  ['books', 'Reading the Odyssey for Lit Hum. This stack is my idea of packing light.'],
];
// Deliberately repetitive NEGATIVE examples for this test only, not production seeds.
const recent = ['Another Lit Hum exam has claimed my last brain cell.', 'POV: deadlines and sleep deprivation won again.'];
let unrelatedAcademicJokes = 0;
try {
  for (const [scene, context] of cases) {
    const prompt = gemini.generationPrompt(context, recent);
    const result = await gemini.generateCaption(png(scene), 'image/png', prompt);
    const academicFallback = scene !== 'books' && /lit\s*hum|\bexam(?:s)?\b|sleep deprivation|\bdeadline(?:s)?\b/i.test(result.caption);
    unrelatedAcademicJokes += Number(academicFallback);
    console.log(JSON.stringify({ scene, context, caption: result.caption, model: result.model, characters: result.caption.length, unrelatedAcademicJoke: academicFallback }));
    recent.unshift(result.caption);
  }
  console.log(`Variety probe complete: ${unrelatedAcademicJokes}/4 unrelated scenes used the discouraged academic themes. Review the distinct punchlines above; five results are a small sample, not a statistical guarantee.`);
  if (unrelatedAcademicJokes) process.exitCode = 1;
} catch {
  console.error('Live variety probe failed (provider/network/configuration failure). No credentials were logged and no captions were persisted.');
  process.exitCode = 1;
}
