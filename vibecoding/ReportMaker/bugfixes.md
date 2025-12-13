When editing the content of a text object, when pressing backspace or delete, the text object is deleted, you should apply these keypresses to the contect textbox.

On the text object, add a context menu (drop down menu) to change the font, size, color, alignment, rotation, opacity, shadow, border, padding, margin, alignment.

Put this text object formatting menu as a toolbar at the top of the screen. Only show it when a text object is selected.
Use icons for the buttons. Similar to the toolbar used in the excel-grid project.


The border of the text object does not work. Implement it correctly.

When a text object is selected, and there is a border, you do not see the selection border.

Do not show the resize handles when a text object is not selected.

When multiple objects are selected, allow for a resize of all selected objects. You should adjust the size of all selected objects to the size of the object that the user is resizing. It seems now that if I select mulitple objects the resize does not work anymore.

When double clicking on a text object, it should enter edit mode. This edit should be in place, so that the user can edit the text directly on the screen.

Text object formatting should also be rendered on the pdf output.

Add an option to set the page size of the report. Margins, orientation, etc.
When changing the page margins, the dropdown closes and I cannot change the values.

Whould it also not make sense, that when nothing is selected, so the page as a whole is selected, that the page setup is editable in the properties panel?

Add to the text object the possibility to set the bold, italic strike-through, underline.


Implement the image object. Allow to upload an image from the file system. When saving the report, save the image in the same directory as the report, and set a relative link to the image in the report.

Embed the image as a bas64 text in the json file of the report. Do not save it seperately.

When a report is saved for the 1st time, ask for a file name and location and save the report there. When saving the report for the 2nd time, use the same file name and location. When a file is loaded, use that file name and location.
Add a save as option to save the report to a different location.

Add the save as option as a dropdown option to the save button. Only allow to save as when a file is already saved and the file is dirty (changed)

Implement the barcode function. Allow for 1D, 2D and QR codes.

Implement in the data region the possibility to connect to a view or a stored procedure. The sqlrest api has been upgraded to support this. /api/views and /api/stored-procedures

Add the possibility to set the stored procedure parameters with the report parameters. ({{parameterName}})


Ok, now refactor the run report & Preview pdf. Combine them into one function. Design this as a 2nd tab in the report editor. At the top of this tab, there should be a run button. When clicked, the report should be run and the pdf should be previewed. If there are parameters defined, the user should be able to set the values at the top of the tab.


Add a button to the report editor to run the report and preview the pdf through the report generator api.
This is just a test to see if the report generator api works and that the generated pdf is correct.

Make sure that the canvas size matches the page size exactly, correct nr of pixels, correct orientation, correct margins, correct page size.
Maybe show the complete page and indicate the margins with a border.

Enable the canvas zooming with the mouse wheel.

Make sure that the page size is correct. For an A4 page:
Width: 210 mm ÷ 25.4 ≈ 8.2677 inches (commonly rounded to 8.27 inches)
Height: 297 mm ÷ 25.4 ≈ 11.6929 inches (commonly rounded to 11.69 inches)

When I generate the pdf with the api, the page size is 11.03 x 15.60 inches, which is not correct.

Adding a rectangle object to the top right corner of the page, (with margins 40px), sets the position of the rectangle to 40px from the right and 40px from the top. When generating the pdf, the rectangle is not at the correct position. It looks like the margins are not taken into account.


Allow for a data region to span multiple pages. If in a data region, a table is defined, depending on the data, the table may span multiple pages. 

Change the report parameter format from {{parameterName}} to @parameterName. This is to prevent the parameter from being evaluated as a js expression.