import {html} from '/event/ui/node_modules/lit-html/lit-html.js';

/**
 * Lays out the given elements in elts, scaling them to all
 * have the same height such that they fill a div of width
 * W and height H, with given spacing between them,
 * without spilling over.
 *
 * @param elts
 * @param W
 * @param H
 * @param spacing
 * @returns an HTML template that can be rendered with the render()
 *  function from Lit-HTMl.
 */
export function flowFill(elts, W, H, spacing) {
  if ((elts || []).length == 0) {
    return null;
  }
  let [eltHeight, err] = optimizeEltHeight(elts, W, H, spacing);
  if (err != null) {
    console.warn(`bisecting failed: ${err}`);
    // Punt.
    eltHeight = 2;
  }
  let las = layoutAtEltHeight(elts, eltHeight, W, spacing);
  return rowsHTML(las.rows, eltHeight, spacing)
}

function rowsHTML(rows, eltHeight, spacing) {
  let spacer = spacerHTML(spacing, spacing);
  let rows2 = rows.map(row => rowHTML(row, eltHeight, spacer));
  let rows3 = intersperse(rows2, spacer);
  return html`
          <div style="width: 100%; height: 100%; position: relative;">
            <div style="position: absolute; top: 50%; transform: translateY(-50%); width: 100%;">
              ${rows3}
            </div>
          </div>
        `;
}

function rowHTML(row, eltHeight, spacer) {
  let items = row.map((elt) => scaledElement(eltHeight, elt));
  let items2 = intersperse(items, spacer);
  return html`
    <div style="display: flex; flex-direction: row; justify-content: center;">
      ${items2}
    </div>
  `;
}

function spacerHTML(spacing) {
  return html`<div style="width: ${spacing}px; height: ${spacing}px; visibility: hidden;"></div>`;
}

/**
 * Returns a copy of xs in which y has been put between the elements.
 * For example intersperse([1,2,3], 0) would return [1, 0, 2, 0, 3].
 *
 * @param xs {[]} Array
 * @param y {*} Something to inject at various places in a copy of the array
 * @returns {[]} The new version of xs with y interspersed
 */
function intersperse(xs, y) {
  let xs2 = [];
  for (let x of xs) {
    xs2.push(x);
    xs2.push(y);
  }
  if (xs2.length > 0) {
    xs2.pop();
  }
  return xs2;
}

function scaledElement(eltHeight, elt) {
  let h = eltHeight;
  let w = width(elt, eltHeight);
  return elt.HTML(w, h);
}

/**
 * Finds the eltHeight that, when applied to all the elements
 * (after they have all been scaled to be the same default height),
 * will cause them to flow to cover as much of the available space
 * as possible in the rectangle of width W and height W, without
 * spilling outside the bounds. The spacing parameter tells how
 * many pixels of space to put between the elements.
 *
 * @param elts
 * @param W
 * @param H
 * @param spacing
 * @returns {string[]|(number|string)[]}
 */
function optimizeEltHeight(elts, W, H, spacing) {
  function ok(eltHeight) {
    let las = layoutAtEltHeight(elts, eltHeight, W, spacing);
    let w = las.w;
    let h = las.h;
    return w < W && h < H;
  }
  // The eltHeight is actually in pixels, being the displayed height of the
  // images. That means we can set the tolerance to 1, since anything
  // less than that is subpixel hence unlikely to be noticed.
  let tol = 1;
  let lo = 1;
  let hi = 1e5;
  if (!ok(lo)) {
    return [null, `low value of ${lo} is unexpectedly not ok`];
  }
  if (ok(hi)) {
    return [null, `high value of ${hi} is unexpectedly ok`];
  }
  return bisect({ lo, hi, ok, tol });
}

/**
 * Finds the highest OK value in the range [lo, hi]
 * assuming that the lo value is OK (i.e., that ok(lo)
 * is true).
 *
 * @param args Object with { lo, hi, ok, tol }:
 *              lo {number} lower bound on range to search in
 *              hi {number} upper bound on range to search in
 *              ok {function} tells whether a given value is acceptable
 *              tol {number} tells when to stop, i.e., when hi - lo <= tol
 * @returns {[number, string]} where the number is the
 *   best value found, and the string is an error message
 *   if an error has occurred (else null).
 */
function bisect(args) {
  let  { lo, hi, ok, tol } = args;
  if (hi - lo <= tol) {
    // Return lo because it is known to be ok.
    return [lo, null];
  }
  let mid = 0.5 * (lo + hi);
  if (ok(mid)) {
    return bisect({ lo: mid, hi, ok, tol });
  } else {
    return bisect({ lo, hi: mid, ok, tol });
  }
}

/**
 * Simulates laying out the given elements in a div of width W,
 * given that the elements have all been scaled to have height
 * given by the eltHeight parameter, spaced according to the given
 * spacing.
 *
 * @param elts
 * @param eltHeight
 * @param W
 * @param spacing
 * @returns {w: number, h: number, rows: []} where w and h give the
 *  size of the bounding box of the elements in the flow layout,
 *  and rows is an array of arrays of elements.
 */
function layoutAtEltHeight(elts, eltHeight, W, spacing) {
  if (elts.length == 0) {
    return {
      w: 0,
      h: 0,
      rows: []
    }
  }

  let rows = [];
  let e = elts[0];
  let row = [e];
  let x0 = 1;
  let x1 = width(e, eltHeight);
  let x1max = x1;
  let y0 = 1;
  let y1 = eltHeight;
  for (let e of elts.slice(1)) {
    let iw = width(e, eltHeight);

    if (x1 + spacing + iw < W) {
      // Lay the element down to the right of its sibling.
      x0 = x1 + spacing;
      x1 = x0 + iw;
      row.push(e);
    } else {
      // Reflow to next line.
      x0 = 1;
      x1 = iw;
      let ih = eltHeight;
      y0 += spacing + ih;
      y1 += spacing + ih;
      rows.push(row);
      row = [e];
    }

    x1max = Math.max(x1max, x1);
  }
  if (row.length != 0) {
    rows.push(row);
  }

  // Sort rows: narrowest at the top, widest at the bottom.
  rows.sort(function(a, b) {
    let wa = rowWidth(a, spacing, eltHeight);
    let wb = rowWidth(b, spacing, eltHeight);
    return wa < wb
      ? -1
      : (wa > wb
        ? 1
        : 0);
  });

  return {
    w: x1max,
    h: y1,
    rows: rows
  }
}

/**
 * Returns the width of the given element elt when scaled so that
 * its height is eltHeight, preserving aspect ratio. The element
 * can be an image or a video.
 *
 * @param elt
 * @param eltHeight {number}
 * @returns {number}
 */
function width(elt, eltHeight) {
  switch (elt.tagName.toLowerCase()) {
    case 'img':
      return eltHeight * elt.naturalWidth / elt.naturalHeight;
      break;
    case 'video':
      return eltHeight * elt.videoWidth / elt.videoHeight;
      break;
    default:
      console.error(`Unexpected tag: ${elt.tagName}`);
  }
}

/**
 * Returns the width of a row of elements with given spacing,
 * with each element scaled independently so its height is eltHeight.
 *
 * @param row
 * @param spacing
 * @param eltHeight
 * @returns {number}
 */
function rowWidth(row, spacing, eltHeight) {
  let sumw = 0;
  for (let elt of row) {
    sumw += width(elt, eltHeight);
  }
  return sumw + spacing * (row.length - 1);
}

/**
 * Repeatedly checks the video v for valid width and height.
 * Once those are set, it calls f(w, h).
 *
 * @param v Video element
 * @param f function to call
 */
export function pollVideoSize(v, f) {
  // Loop until we can get valid values for the video width and height.
  if (!(v.videoWidth && v.videoHeight)) {
    let iid = null;
    function check() {
      if (v.videoWidth && v.videoHeight) {
        clearInterval(iid);
        f(v.videoWidth, v.videoHeight);
      }
    }
    iid = setInterval(check, 50);
  }
}
