namespace Roster.Domain.Tests.Aggregates;

using FluentAssertions;
using Roster.Domain.Aggregates;
using Roster.Domain.Events;
using Roster.Domain.Exceptions;

public class GameAggregateTests
{
    // T042: Game init and absence events
    [Fact]
    public void Apply_GameCreated_SetsAllFields()
    {
        var agg = new GameAggregate();
        var gameId = Guid.NewGuid();
        var teamId = Guid.NewGuid();

        agg.Apply(new GameCreated
        {
            TeamId = teamId, GameId = gameId,
            Date = new DateOnly(2026, 4, 12),
            Opponent = "Tigers", InningCount = 6
        });

        agg.GameId.Should().Be(gameId);
        agg.TeamId.Should().Be(teamId);
        agg.Date.Should().Be(new DateOnly(2026, 4, 12));
        agg.Opponent.Should().Be("Tigers");
        agg.InningCount.Should().Be(6);
        agg.IsLocked.Should().BeFalse();
        agg.AbsentPlayerIds.Should().BeEmpty();
    }

    [Fact]
    public void Apply_PlayerMarkedAbsent_AddsToAbsentList()
    {
        var agg = CreateGame();
        var playerId = Guid.NewGuid();

        agg.Apply(new PlayerMarkedAbsent { TeamId = agg.TeamId, GameId = agg.GameId, PlayerId = playerId });

        agg.AbsentPlayerIds.Should().Contain(playerId);
    }

    [Fact]
    public void Apply_PlayerAbsenceRevoked_RemovesFromAbsentList()
    {
        var agg = CreateGame();
        var playerId = Guid.NewGuid();
        agg.Apply(new PlayerMarkedAbsent { TeamId = agg.TeamId, GameId = agg.GameId, PlayerId = playerId });

        agg.Apply(new PlayerAbsenceRevoked { TeamId = agg.TeamId, GameId = agg.GameId, PlayerId = playerId });

        agg.AbsentPlayerIds.Should().NotContain(playerId);
    }

    [Fact]
    public void Apply_MutatingEvent_AfterGameLocked_ThrowsDomainException()
    {
        var agg = CreateGame();
        agg.Apply(new GameLocked { TeamId = agg.TeamId, GameId = agg.GameId });

        var act = () => agg.Apply(new PlayerMarkedAbsent
            { TeamId = agg.TeamId, GameId = agg.GameId, PlayerId = Guid.NewGuid() });

        act.Should().Throw<DomainException>().WithMessage("*locked*");
    }

    // T043: Lineup events
    [Fact]
    public void Apply_BattingOrderSet_ReplacesBattingOrder()
    {
        var agg = CreateGame();
        var p1 = Guid.NewGuid();
        var p2 = Guid.NewGuid();

        agg.Apply(new BattingOrderSet
            { TeamId = agg.TeamId, GameId = agg.GameId, OrderedPlayerIds = [p1, p2] });

        agg.BattingOrder.Should().BeEquivalentTo(new[] { p1, p2 }, o => o.WithStrictOrdering());
    }

    [Fact]
    public void Apply_InningFieldingAssigned_ReplacesInningAssignments()
    {
        var agg = CreateGame();
        var p1 = Guid.NewGuid();
        var p2 = Guid.NewGuid();

        agg.Apply(new InningFieldingAssigned
        {
            TeamId = agg.TeamId, GameId = agg.GameId, InningNumber = 1,
            Assignments = [new(p1, "Pitcher"), new(p2, "Catcher")]
        });

        agg.InningAssignments.Should().ContainKey(1);
        agg.InningAssignments[1].Should().HaveCount(2);
    }

    [Fact]
    public void Apply_InningFieldingAssigned_DuplicateNonBenchPosition_ThrowsDomainException()
    {
        var agg = CreateGame();
        var p1 = Guid.NewGuid();
        var p2 = Guid.NewGuid();

        var act = () => agg.Apply(new InningFieldingAssigned
        {
            TeamId = agg.TeamId, GameId = agg.GameId, InningNumber = 1,
            Assignments = [new(p1, "Pitcher"), new(p2, "Pitcher")]
        });

        act.Should().Throw<DomainException>().WithMessage("*Pitcher*");
    }

    [Fact]
    public void Apply_InningFieldingAssigned_BenchSharedByMultiplePlayers_IsValid()
    {
        var agg = CreateGame();
        var p1 = Guid.NewGuid();
        var p2 = Guid.NewGuid();

        var act = () => agg.Apply(new InningFieldingAssigned
        {
            TeamId = agg.TeamId, GameId = agg.GameId, InningNumber = 1,
            Assignments = [new(p1, "Bench"), new(p2, "Bench")]
        });

        act.Should().NotThrow();
    }

    private static GameAggregate CreateGame()
    {
        var agg = new GameAggregate();
        agg.Apply(new GameCreated
        {
            TeamId = Guid.NewGuid(), GameId = Guid.NewGuid(),
            Date = DateOnly.FromDateTime(DateTime.Today),
            InningCount = 6
        });
        return agg;
    }
}
