In the report maker add the possibility to use an LLM to generate the report.

The LLM should get the database schema and the data from the sqlrest api.

The user will ask a question and the LLM should generate a report based on that question.

The LLM should use the database schema to understand the data and the data to generate the report.

Use the openrouter api to get the LLM response.
The model should be mistralai/devstral-2512
I will set the api key in the config file.


Issues:

when generating a report with the LLMthe dataregion does not seem to be connected to the datasource. I would expect a link to the sqlrest api and a custom sql query to be generated.

In the LLM tab load all table information from the database. DO not let the user select the tables.
The prompt will be based on data from the whole database.

[x] When calculating the report with the LLM, show a loading screen.
[ ] Add standard prompts to select from, like:
- add a header and a footer with page numbering and title


Put the LLM prompt in a seperate collapsable panel at the bottom of the editor (under the canvas).
Do not show a list of the tables or views in the LLM panel. Only show a prompt field and a generate button.
Also allow the prompt to interact with the existing report allowing for changes by the ai on the report.

Keep a history of the prompts and the responses. Use this with subsequent prompts to generate or adjust the report.