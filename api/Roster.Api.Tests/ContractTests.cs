namespace Roster.Api.Tests;

using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using System.Net;
using Roster.Infrastructure.InMemory;
using Roster.Infrastructure.EventStore;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Logging.Abstractions;

/// <summary>
/// Replaces the real AggregateReplayService with a stub that signals ready
/// immediately — no Kafka broker required, no timeouts.
/// </summary>
public sealed class NoKafkaWebApplicationFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(Microsoft.AspNetCore.Hosting.IWebHostBuilder builder)
    {
        builder.ConfigureServices(services =>
        {
            // Replace the real replay service with the immediately-ready stub
            services.RemoveAll<AggregateReplayService>();
            services.RemoveAll<IHostedService>();

            services.AddSingleton<AggregateReplayService, ImmediatelyReadyReplayService>();
            services.AddHostedService(sp => sp.GetRequiredService<AggregateReplayService>());
        });
    }
}

/// <summary>BackgroundService stub: marks ready on first tick, never touches Kafka.</summary>
internal sealed class ImmediatelyReadyReplayService : AggregateReplayService
{
    public ImmediatelyReadyReplayService(
        InMemoryStore store,
        Microsoft.Extensions.Logging.ILogger<AggregateReplayService> logger,
        IOptions<RedpandaOptions> options)
        : base(store, logger, options) { }

    protected override Task ExecuteAsync(CancellationToken stoppingToken)
    {
        MarkReady();
        return Task.CompletedTask;
    }
}

[Trait("Category", "Contract")]
public class ContractTests : IClassFixture<NoKafkaWebApplicationFactory>
{
    private readonly NoKafkaWebApplicationFactory _factory;

    public ContractTests(NoKafkaWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Health_ReturnsOkWhenReplayServiceReady()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/health");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task PostTeams_WithoutBody_ReturnsBadRequest()
    {
        var client = _factory.CreateClient();
        var response = await client.PostAsync("/teams",
            new StringContent("{}", System.Text.Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetTeam_WithoutSecret_Returns401()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync($"/teams/{Guid.NewGuid()}");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task SwaggerJson_IsAccessible()
    {
        var client = _factory
            .WithWebHostBuilder(b =>
                b.UseSetting("ASPNETCORE_ENVIRONMENT", "Development"))
            .CreateClient();
        var response = await client.GetAsync("/swagger/v1/swagger.json");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadAsStringAsync();
        Assert.Contains("Roster API", json);
    }
}
