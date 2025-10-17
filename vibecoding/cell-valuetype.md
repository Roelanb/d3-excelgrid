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