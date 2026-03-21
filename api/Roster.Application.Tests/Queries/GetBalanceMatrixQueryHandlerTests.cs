namespace Roster.Application.Tests.Queries;

using FluentAssertions;
using NSubstitute;
using Roster.Application.Interfaces;
using Roster.Application.Queries.GetBalanceMatrix;
using Roster.Domain.Aggregates;
using Roster.Domain.Events;

public class GetBalanceMatrixQueryHandlerTests
{
    [Fact]
    public async Task Handle_GamesWithAssignments_ReturnsCorrectCounts()
    {
        var store = Substitute.For<IInMemoryStore>();
        var teamId = Guid.NewGuid();
        var p1 = Guid.NewGuid();
        var p2 = Guid.NewGuid();

        var team = new TeamAggregate();
        team.Apply(new TeamCreated { TeamId = teamId, Name = "T", SportName = "Softball", AccessSecretHash = "h" });
        team.Apply(new PlayerAdded { TeamId = teamId, PlayerId = p1, Name = "Alice" });
        team.Apply(new PlayerAdded { TeamId = teamId, PlayerId = p2, Name = "Bob" });
        store.GetTeam(teamId).Returns(team);

        // Game 1: 2 innings — p1 as Pitcher, p2 as Bench (×2 innings)
        var gameId1 = Guid.NewGuid();
        var game1 = new GameAggregate();
        game1.Apply(new GameCreated { TeamId = teamId, GameId = gameId1, Date = DateOnly.FromDateTime(DateTime.Today), InningCount = 2 });
        game1.Apply(new InningFieldingAssigned
        {
            TeamId = teamId, GameId = gameId1, InningNumber = 1,
            Assignments = [new(p1, "Pitcher"), new(p2, "Bench")]
        });
        game1.Apply(new InningFieldingAssigned
        {
            TeamId = teamId, GameId = gameId1, InningNumber = 2,
            Assignments = [new(p1, "Catcher"), new(p2, "Bench")]
        });

        store.GetGamesForTeam(teamId).Returns([game1]);

        var handler = new GetBalanceMatrixQueryHandler(store);
        var result = await handler.Handle(new GetBalanceMatrixQuery(teamId), CancellationToken.None);

        var alice = result.Rows.Single(r => r.PlayerId == p1);
        alice.Counts["Pitcher"].Should().Be(1);
        alice.Counts["Catcher"].Should().Be(1);
        alice.Counts["Bench"].Should().Be(0);

        var bob = result.Rows.Single(r => r.PlayerId == p2);
        bob.Counts["Bench"].Should().Be(2);
        bob.Counts["Pitcher"].Should().Be(0);
    }

    [Fact]
    public async Task Handle_AllPositionsIncludingBench_PresentInCounts()
    {
        var store = Substitute.For<IInMemoryStore>();
        var teamId = Guid.NewGuid();
        var p1 = Guid.NewGuid();

        var team = new TeamAggregate();
        team.Apply(new TeamCreated { TeamId = teamId, Name = "T", SportName = "Softball", AccessSecretHash = "h" });
        team.Apply(new PlayerAdded { TeamId = teamId, PlayerId = p1, Name = "Alice" });
        store.GetTeam(teamId).Returns(team);
        store.GetGamesForTeam(teamId).Returns([]);

        var handler = new GetBalanceMatrixQueryHandler(store);
        var result = await handler.Handle(new GetBalanceMatrixQuery(teamId), CancellationToken.None);

        var alice = result.Rows.Single();
        // All 10 Softball positions + Bench = 11 keys
        alice.Counts.Should().ContainKey("Pitcher");
        alice.Counts.Should().ContainKey("Bench");
        alice.Counts.Values.Should().AllSatisfy(v => v.Should().Be(0));
    }

    [Fact]
    public async Task Handle_InactivePlayers_StillAppearInMatrix()
    {
        var store = Substitute.For<IInMemoryStore>();
        var teamId = Guid.NewGuid();
        var p1 = Guid.NewGuid();

        var team = new TeamAggregate();
        team.Apply(new TeamCreated { TeamId = teamId, Name = "T", SportName = "Softball", AccessSecretHash = "h" });
        team.Apply(new PlayerAdded { TeamId = teamId, PlayerId = p1, Name = "Alice" });
        team.Apply(new PlayerDeactivated { TeamId = teamId, PlayerId = p1 });
        store.GetTeam(teamId).Returns(team);
        store.GetGamesForTeam(teamId).Returns([]);

        var handler = new GetBalanceMatrixQueryHandler(store);
        var result = await handler.Handle(new GetBalanceMatrixQuery(teamId), CancellationToken.None);

        result.Rows.Should().HaveCount(1);
        result.Rows[0].IsActive.Should().BeFalse();
    }
}
