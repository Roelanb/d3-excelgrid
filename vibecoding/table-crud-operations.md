Allow the possiblity to edit the connected table data (CRUD operations)

Add a button (similar to the green triangle), that puts the table in edit mode.
The user can then edit data in the table. Indicate that changed or edited cells are dirty.

Add a save button (similar to the green triangle), that puts commits all changed data to the database.

Special considerations:

- identify the primary key of the table, this is not editable
- add the possibility to remove rows
- add the possibility to add rows

Before you can implement the UI, you need to implement the CRUD operations on the backend API.
This is in the dotnet project sqlrest.

Can you check the edit mode for database tables in the excel-grid. I cen enter edit mode, but when data is updated, please show that in the grid by changing the background color of the cell. So that we know the record is dirty.
When Saving the data, it should be commited to the database. Currently it is not saving.

Add a log table to the Database Connection Details that shows the database changes that the use has done.