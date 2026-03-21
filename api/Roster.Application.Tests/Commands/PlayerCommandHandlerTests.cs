namespace Roster.Application.Tests.Commands;

using FluentAssertions;
using NSubstitute;
using Roster.Application.Commands.AddPlayer;
using Roster.Application.Commands.DeactivatePlayer;
using Roster.Application.Commands.RatePlayerSkill;
using Roster.Application.Interfaces;
using Roster.Domain.Aggregates;
using Roster.Domain.Events;
using Roster.Domain.Exceptions;
using Roster.Domain.Interfaces;

public class PlayerCommandHandlerTests
{
    private readonly IEventStore _eventStore;
    private readonly IInMemoryStore _store;

    public PlayerCommandHandlerTests()
    {
        _eventStore = Substitute.For<IEventStore>();
        _store = Substitute.For<IInMemoryStore>();
    }

    // T034: AddPlayerCommandHandler
    [Fact]
    public async Task AddPlayer_EmitsPlayerAddedEvent()
    {
        var teamId = Guid.NewGuid();
        var team = CreateTeam(teamId);
        _store.GetTeam(teamId).Returns(team);

        IReadOnlyList<DomainEvent>? captured = null;
        await _eventStore.AppendAsync(Arg.Do<IReadOnlyList<DomainEvent>>(e => captured = e), Arg.Any<CancellationToken>());

        var handler = new AddPlayerCommandHandler(_eventStore, _store);
        await handler.Handle(new AddPlayerCommand(teamId, "Jane Smith"), CancellationToken.None);

        captured.Should().HaveCount(1);
        captured![0].Should().BeOfType<PlayerAdded>();
        ((PlayerAdded)captured[0]).Name.Should().Be("Jane Smith");
    }

    [Fact]
    public async Task RatePlayerSkill_InvalidSkillName_ThrowsDomainException()
    {
        var teamId = Guid.NewGuid();
        var team = CreateTeam(teamId);
        var playerId = Guid.NewGuid();
        AddPlayerToTeam(team, playerId);
        _store.GetTeam(teamId).Returns(team);

        var handler = new RatePlayerSkillCommandHandler(_eventStore, _store);
        var act = () => handler.Handle(new RatePlayerSkillCommand(teamId, playerId, "InvalidSkill", 3), CancellationToken.None);

        await act.Should().ThrowAsync<DomainException>();
    }

    [Fact]
    public async Task RatePlayerSkill_RatingOutOfRange_ThrowsDomainException()
    {
        var teamId = Guid.NewGuid();
        var team = CreateTeam(teamId);
        var playerId = Guid.NewGuid();
        AddPlayerToTeam(team, playerId);
        _store.GetTeam(teamId).Returns(team);

        var handler = new RatePlayerSkillCommandHandler(_eventStore, _store);
        var act = () => handler.Handle(new RatePlayerSkillCommand(teamId, playerId, "Hitting", 6), CancellationToken.None);

        await act.Should().ThrowAsync<DomainException>();
    }

    [Fact]
    public async Task DeactivatePlayer_AlreadyInactive_ThrowsDomainException()
    {
        var teamId = Guid.NewGuid();
        var team = CreateTeam(teamId);
        var playerId = Guid.NewGuid();
        AddPlayerToTeam(team, playerId);
        team.Apply(new PlayerDeactivated { TeamId = teamId, PlayerId = playerId });
        _store.GetTeam(teamId).Returns(team);

        var handler = new DeactivatePlayerCommandHandler(_eventStore, _store);
        var act = () => handler.Handle(new DeactivatePlayerCommand(teamId, playerId), CancellationToken.None);

        await act.Should().ThrowAsync<DomainException>();
    }

    private static TeamAggregate CreateTeam(Guid teamId)
    {
        var team = new TeamAggregate();
        team.Apply(new TeamCreated { TeamId = teamId, Name = "Team", SportName = "Softball", AccessSecretHash = "hash" });
        return team;
    }

    private static void AddPlayerToTeam(TeamAggregate team, Guid playerId)
    {
        team.Apply(new PlayerAdded { TeamId = team.TeamId, PlayerId = playerId, Name = "Test Player" });
    }
}
