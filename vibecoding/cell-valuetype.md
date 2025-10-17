The system should infer the datatype of the cell from its contents.

Add to the toolbar an option (dropdown) to change the datatype.

Possible datatypes:
- string
- number
- date
- boolean
- guid
- uri
- email
- phone
- time
- datetime
- duration
- currency
- percentage
 
Improve the logic for determining the datatype of the cell. when is is a integer or float, it should be a number.
Only take a currency when the user  add a $ or € sign.

Improve the logic for determining the datatype of the cell. Following formats are for instancce dates:
- 2024-01-15
- 2024-01-15T14:30:00
- 2024-01-15 14:30:00
- Feb 10 2024   
- 10/02/2024
- 10-02-2024
- 10-2-2024
- 10 Feb 2024
- 01-Jan-2024
- 15 Jan 2024
- 15 Jan 2024 14:30


Add an option to further specify the date format. The cell should then be formatted according to the selected format.