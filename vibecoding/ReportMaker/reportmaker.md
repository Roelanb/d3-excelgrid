Create a webapp in react/vite - typescript
Put it in a folder called reportmaker.

That allows the user to create  custom reports from a database.

The user should be able to drag and drop report objects to a canvas. These object can be:

- Text
- Image
- Chart
- Table
- Barcode

Add the following features:

- Gridlines
- Snap to grid
- colors
- font
- size
- rotation
- opacity
- shadow
- border
- padding
- margin
- alignment
 

 For the canvas and the report objects use D3.js to draw the objects on the canvas.


Add the ability to add data regions to the report. Data regions are used to define the data that is used in that region.
It can make a connection to the sqlrest api to get the data.

The user will then be able to add objects to that data region. The object will be able to use the data from the data region.


In the dataregion, make it possible to connect to the rest api. (use for testing usercd: admin password: admin)
You can query the api with the following url: http://localhost:3200/api/v1/tables. This will return a list of all the tables that can be selected. (and the schema of the tables)

The user can then select a table. You can query the api with the following url: http://localhost:3200/api/v1/tables/{table}. This will return the data of the selected table.


[x] Add the possibility to resize controls.


[x] Add the possibility to remove controls.
[x] Add the possibility to copy and paste controls.
[ ] Enable mouse region selection.


Add a preview tab to see how the report will look like. Render the report as a PDF file, and show it in a iframe.

The objects should use the data in the fields of the data region to display the data. 
A single field, like a text object, can use the data from the data region to display the data. To get the data you should call the sqlrest api with the table name, this will return all the data.


Allow the user to align the objects on the canvas.
- Left align
- Right align
- Top align
- Bottom align
- Center align
- Distribute horizontally
- Distribute vertically
- Same width
- Same height

[x] Add the possibility to save the report as a json file.
[x] Add the possibility to load a report from a json file.


[x] Add lines, rectangles, ellipses, polygons, and polylines objects.


For the Table object, when it is added to a dataregion, it should use the data from the dataregion to display the data. The user should be able to link it to a table in the dataregion.
Then the table should display all the rows of the selected table.

[x] Add a header component, this is always on top of the report and appears on every page.
[x] Add a footer component, this is always on bottom of the report and appears on every page.

Editor layout improvments
[X] Add a new report button and show the filename of the report in the title when I save it, or load a file
[X] Show the text style buttons as a seperate toolbar row

Can you put the text style toolbar vertivally to the left of the canvas, right of the components tab

[X] On the proterties tab make the sections (like Layout, typography etc) collapsable
[X] show the filename of the report in the title
[ ] Add extra properties to the report, Report name, description, author, etc
[ ] make the report parameters collapsed by default

Sql editor
[ ] Allow for complex sql queries to be used in the dataregion. Add a sql editor to edit the sql command easily.
[ ] Improve the comples sql editor, add a button to edit the text in a larger window.

Table layout improvments:
- add the possibitlity to style the header row, allow the user to click on the header row or cell and use the textbox syyle options

[ ] when a header cell or row is selected, show its properties in the properties tab 

- add the possibility to define (add/remove/update) columns in the table

- add the possibitlity to set the column width of each column to auto
- add the possibitlity to set the column width of each column to a fixed value


When the whole header is selected, and I change the backgound color, only the color of 1 cell is changed


Integrate the data region properties directly in the table object. So that adding a table object to the canvas is possible without a data region.

Create a new object called a datatable. This should act the same way as a datatable in Microsoft reporting services.
It links to a database query and can be used to display data in a table. 
The user can drag columns from the dataconenction to the table.
The user canb resize columns and rows. 
The user can devine a totals row.
The user can add groupings to the table, base on 1 or multiple columns to group by.