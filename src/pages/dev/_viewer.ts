import { planDrawing, sheetOffset, type LevelId } from '../../scripts/experience/building/plan';
import { paintPlan, sheetLayout } from '../../scripts/experience/building/planSheet';
import { devSheets } from './_sheets';

/*
 * The dev viewer's painter: each floor of the sheet named by `data-sheet`,
 * drawn and painted exactly as the site paints its sheet, then finished as
 * the site's shader finishes it. Loaded by /dev/[plan] straight from the dev
 * server, never bundled, so nothing of it reaches a build.
 */

/** As on the site: bone ink on the plot's board, at the desktop sheet's resolution. */
const BONE = '#ede6da';
const BOARD = '#2b2723';
const PIXELS_PER_METRE = 118;
/** Each ink's strength in the site's sheet shader: what the plan cuts, the lines, the notes. */
const STRENGTH = [1, 0.8, 0.72];
/** Canvas sides stay under the browsers' limit. */
const MAX_SIDE = 16384;

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** The three ink channels finished as the shader finishes them: bone over the board, the strongest ink winning. */
function inkOnBoard(context: CanvasRenderingContext2D) {
  const { width, height } = context.canvas;
  const image = context.getImageData(0, 0, width, height);
  const { data } = image;
  const bone = rgb(BONE);
  const board = rgb(BOARD);
  for (let i = 0; i < data.length; i += 4) {
    const alpha = Math.max(data[i] * STRENGTH[0], data[i + 1] * STRENGTH[1], data[i + 2] * STRENGTH[2]) / 255;
    for (let c = 0; c < 3; c++) data[i + c] = board[c] + (bone[c] - board[c]) * alpha;
    data[i + 3] = 255;
  }
  context.putImageData(image, 0, 0);
}

/** The family the site letters the plan in, once its two weights have loaded. */
async function letteringFont() {
  const family = getComputedStyle(document.documentElement).getPropertyValue('--font-dm-sans').trim() || 'sans-serif';
  await Promise.all([document.fonts.load(`400 32px ${family}`), document.fonts.load(`500 32px ${family}`)]).catch(() => {});
  return family;
}

async function show(holder: HTMLElement) {
  const sheet = devSheets().find((candidate) => candidate.id === holder.dataset.sheet);
  if (!sheet) return;
  const { plan, site } = sheet;
  const font = await letteringFont();
  const offset = sheetOffset(plan);
  const scale = Math.min(PIXELS_PER_METRE * devicePixelRatio, MAX_SIDE / Math.max(site.width, site.depth));
  const levels: LevelId[] = plan.upper ? ['ground', 'upper'] : ['ground'];
  for (const level of levels) {
    const layout = sheetLayout(plan, site, offset, scale);
    const canvas = document.createElement('canvas');
    canvas.width = layout.width;
    canvas.height = layout.height;
    canvas.style.width = `${site.width * PIXELS_PER_METRE}px`;
    const context = canvas.getContext('2d', { willReadFrequently: true })!;
    paintPlan(context, planDrawing(plan, layout.frame, level), layout.toCanvas, scale, font);
    inkOnBoard(context);
    holder.append(canvas);
  }
  holder.dataset.painted = levels.join(' ');
}

const holder = document.querySelector<HTMLElement>('[data-sheet]');
if (holder) void show(holder);
