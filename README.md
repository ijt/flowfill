# flowfill
Flowfill is a JavaScript layout algorithm for videos and images.

To try it out run
```bash
npm install lit-html
```
and then open demo.html in a browser. Try resizing the browser window to see how the layout algorithmm adapts.

## How it works
Flowfill uses bisection to find the optimal height for a set of videos such that they will fill a rectangle with given width and height without spilling over.

Flowfill works with the lit-html library from Google. Background on lit-html is available at https://lit-html.polymer-project.org/.
