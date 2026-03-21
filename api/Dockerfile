# Build stage
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Copy solution and project files for layer caching
COPY Roster.sln .
COPY Roster.Domain/Roster.Domain.csproj Roster.Domain/
COPY Roster.Application/Roster.Application.csproj Roster.Application/
COPY Roster.Infrastructure/Roster.Infrastructure.csproj Roster.Infrastructure/
COPY Roster.Api/Roster.Api.csproj Roster.Api/

# Restore
RUN dotnet restore Roster.sln

# Copy source
COPY Roster.Domain/ Roster.Domain/
COPY Roster.Application/ Roster.Application/
COPY Roster.Infrastructure/ Roster.Infrastructure/
COPY Roster.Api/ Roster.Api/

# Build and publish
RUN dotnet publish Roster.Api/Roster.Api.csproj -c Release -o /app/publish --no-restore

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app

# Install curl for ECS health checks
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/publish .

EXPOSE 8080

ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production

ENTRYPOINT ["dotnet", "Roster.Api.dll"]
