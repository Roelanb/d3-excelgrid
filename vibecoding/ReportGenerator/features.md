Create a c# dotnet 9 rest api that can be used to generate reports.

POST /api/generate request body:
{
    "report": { json structure of the report},
    "data": {json structure of the input data}
    "output": {json structure of the output data}"
}

create it in the folder  /reportgenerator. 



Update the reportmaker to only use the reportgenerator api to generate the report. Remove the run (local) option. And remove the code in the reportmaker that is used to generate the report. 
