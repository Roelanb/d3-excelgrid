Add the ability to set the report parameters.

A report parameter is a variable that can be used in the report.

 It can be following types:
 - string
 - integer number,
 - float number,
 - date,
 - time,
 - datetime,
 - date range
 - boolean,
 - a list of values (strings, numbers)
 - a email address
 
- parameters can be mandatory or optional.
- parameters can have a default value.
- parameters can have a description.
- parameters can have a placeholder.
- parameters can have a label.

Create a seperate panel for the report parameters. This panel should be collapsable and should be at the top of the screen.
You can add parameters to the report by clicking on the + button in the report parameters panel.
You can remove parameters by clicking on the - button in the report parameters panel.
Parameters should be persisted in the json file of the report.

Add the possbility to use the parameter in  the report objects.
This can be done by using the {{parameterName}} syntax in the report object.



[ ]