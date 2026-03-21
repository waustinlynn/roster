namespace Roster.Domain.Tests.Aggregates;

using FluentAssertions;
using Roster.Domain.Aggregates;
using Roster.Domain.Events;
using Roster.Domain.Exceptions;
using Roster.Domain.ValueObjects;

public class TeamAggregateTests
{
    // T025: TeamCreated tests
    [Fact]
    public void Apply_TeamCreated_SetsAllFields()
    {
        var teamId = Guid.NewGuid();
        var aggregate = new TeamAggregate();

        aggregate.Apply(new TeamCreated
        {
            TeamId = teamId,
            Name = "Thunderbolts",
            SportName = "Softball",
            AccessSecretHash = "abc123hash",
        });

        aggregate.TeamId.Should().Be(teamId);
        aggregate.Name.Should().Be("Thunderbolts");
        aggregate.AccessSecretHash.Should().Be("abc123hash");
        aggregate.Sport.Should().NotBeNull();
        aggregate.Sport!.Name.Should().Be("Softball");
    }

    [Fact]
    public void Apply_TeamCreated_LoadsSoftballPositions()
    {
        var aggregate = new TeamAggregate();

        aggregate.Apply(new TeamCreated
        {
            TeamId = Guid.NewGuid(),
            Name = "Team",
            SportName = "Softball",
            AccessSecretHash = "hash",
        });

        aggregate.Sport!.Positions.Should().HaveCount(10);
        aggregate.Sport.Positions.Should().Contain("Pitcher");
        aggregate.Sport.Positions.Should().Contain("Catcher");
        aggregate.Sport.Skills.Should().BeEquivalentTo(["Hitting", "Catching", "Throwing"]);
    }

    [Fact]
    public void Apply_TeamCreated_IncrementsVersion()
    {
        var aggregate = new TeamAggregate();
        aggregate.Version.Should().Be(0);

        aggregate.Apply(new TeamCreated
        {
            TeamId = Guid.NewGuid(),
            Name = "Team",
            SportName = "Softball",
            AccessSecretHash = "hash",
        });

        aggregate.Version.Should().Be(1);
    }

    [Fact]
    public void Apply_SecondTeamCreated_ThrowsDomainException()
    {
        var aggregate = new TeamAggregate();
        var teamId = Guid.NewGuid();

        aggregate.Apply(new TeamCreated
        {
            TeamId = teamId,
            Name = "Team",
            SportName = "Softball",
            AccessSecretHash = "hash",
        });

        var act = () => aggregate.Apply(new TeamCreated
        {
            TeamId = teamId,
            Name = "Team2",
            SportName = "Softball",
            AccessSecretHash = "hash2",
        });

        act.Should().Throw<DomainException>();
    }

    // T033: Player aggregate apply tests
    [Fact]
    public void Apply_PlayerAdded_AppendsPlayerWithEmptySkills()
    {
        var aggregate = CreateInitializedTeam();
        var playerId = Guid.NewGuid();

        aggregate.Apply(new PlayerAdded { TeamId = aggregate.TeamId, PlayerId = playerId, Name = "Jane Smith" });

        aggregate.Players.Should().ContainKey(playerId);
        aggregate.Players[playerId].Name.Should().Be("Jane Smith");
        aggregate.Players[playerId].IsActive.Should().BeTrue();
        aggregate.Players[playerId].Skills.Should().BeEmpty();
    }

    [Fact]
    public void Apply_PlayerSkillRated_SetsSkillOnPlayer()
    {
        var aggregate = CreateInitializedTeam();
        var playerId = Guid.NewGuid();
        aggregate.Apply(new PlayerAdded { TeamId = aggregate.TeamId, PlayerId = playerId, Name = "Jane" });

        aggregate.Apply(new PlayerSkillRated { TeamId = aggregate.TeamId, PlayerId = playerId, SkillName = "Hitting", Rating = 4 });

        aggregate.Players[playerId].Skills["Hitting"].Should().Be(4);
    }

    [Fact]
    public void Apply_PlayerSkillRated_OnDeactivatedPlayer_ThrowsDomainException()
    {
        var aggregate = CreateInitializedTeam();
        var playerId = Guid.NewGuid();
        aggregate.Apply(new PlayerAdded { TeamId = aggregate.TeamId, PlayerId = playerId, Name = "Jane" });
        aggregate.Apply(new PlayerDeactivated { TeamId = aggregate.TeamId, PlayerId = playerId });

        var act = () => aggregate.Apply(new PlayerSkillRated { TeamId = aggregate.TeamId, PlayerId = playerId, SkillName = "Hitting", Rating = 4 });

        act.Should().Throw<DomainException>();
    }

    [Fact]
    public void Apply_PlayerDeactivated_SetsIsActiveFalse()
    {
        var aggregate = CreateInitializedTeam();
        var playerId = Guid.NewGuid();
        aggregate.Apply(new PlayerAdded { TeamId = aggregate.TeamId, PlayerId = playerId, Name = "Jane" });

        aggregate.Apply(new PlayerDeactivated { TeamId = aggregate.TeamId, PlayerId = playerId });

        aggregate.Players[playerId].IsActive.Should().BeFalse();
    }

    private static TeamAggregate CreateInitializedTeam()
    {
        var agg = new TeamAggregate();
        agg.Apply(new TeamCreated { TeamId = Guid.NewGuid(), Name = "Team", SportName = "Softball", AccessSecretHash = "hash" });
        return agg;
    }
}
