FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

COPY reportgenerator/ReportGenerator.csproj reportgenerator/
RUN dotnet restore reportgenerator/ReportGenerator.csproj

COPY reportgenerator/ reportgenerator/
WORKDIR /src/reportgenerator
RUN dotnet restore
RUN dotnet publish -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app

ENV ASPNETCORE_URLS=http://0.0.0.0:8080
EXPOSE 8080

COPY --from=build /app/publish ./
ENTRYPOINT ["dotnet", "ReportGenerator.dll"]
