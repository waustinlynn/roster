namespace Roster.Application.Tests.Commands;

using FluentAssertions;
using NSubstitute;
using Roster.Application.Commands.AssignInningFielding;
using Roster.Application.Commands.CreateGame;
using Roster.Application.Commands.LockGame;
using Roster.Application.Commands.MarkPlayerAbsent;
using Roster.Application.Commands.SetBattingOrder;
using Roster.Application.Interfaces;
using Roster.Domain.Aggregates;
using Roster.Domain.Events;
using Roster.Domain.Exceptions;
using Roster.Domain.Interfaces;

public class GameCommandHandlerTests
{
    private readonly IEventStore _eventStore;
    private readonly IInMemoryStore _store;

    public GameCommandHandlerTests()
    {
        _eventStore = Substitute.For<IEventStore>();
        _store = Substitute.For<IInMemoryStore>();
    }

    [Fact]
    public async Task CreateGame_ValidCommand_EmitsGameCreatedEvent()
    {
        var teamId = Guid.NewGuid();
        _store.GetTeam(teamId).Returns(CreateTeam(teamId));

        IReadOnlyList<DomainEvent>? captured = null;
        await _eventStore.AppendAsync(
            Arg.Do<IReadOnlyList<DomainEvent>>(e => captured = e),
            Arg.Any<CancellationToken>());

        var handler = new CreateGameCommandHandler(_eventStore, _store);
        await handler.Handle(new CreateGameCommand(teamId, "2026-04-12", "Tigers", 6), CancellationToken.None);

        captured.Should().HaveCount(1);
        captured![0].Should().BeOfType<GameCreated>();
    }

    [Fact]
    public async Task MarkPlayerAbsent_ValidPlayer_EmitsEvent()
    {
        var teamId = Guid.NewGuid();
        var gameId = Guid.NewGuid();
        var playerId = Guid.NewGuid();
        var team = CreateTeam(teamId);
        AddPlayer(team, playerId);
        var game = CreateGame(teamId, gameId);
        _store.GetTeam(teamId).Returns(team);
        _store.GetGame(gameId).Returns(game);

        IReadOnlyList<DomainEvent>? captured = null;
        await _eventStore.AppendAsync(
            Arg.Do<IReadOnlyList<DomainEvent>>(e => captured = e),
            Arg.Any<CancellationToken>());

        var handler = new MarkPlayerAbsentCommandHandler(_eventStore, _store);
        await handler.Handle(new MarkPlayerAbsentCommand(teamId, gameId, playerId), CancellationToken.None);

        captured![0].Should().BeOfType<PlayerMarkedAbsent>();
    }

    [Fact]
    public async Task SetBattingOrder_AbsentPlayer_ThrowsDomainException()
    {
        var teamId = Guid.NewGuid();
        var gameId = Guid.NewGuid();
        var playerId = Guid.NewGuid();
        var team = CreateTeam(teamId);
        AddPlayer(team, playerId);
        var game = CreateGame(teamId, gameId);
        game.Apply(new PlayerMarkedAbsent { TeamId = teamId, GameId = gameId, PlayerId = playerId });
        _store.GetTeam(teamId).Returns(team);
        _store.GetGame(gameId).Returns(game);

        var handler = new SetBattingOrderCommandHandler(_eventStore, _store);
        var act = () => handler.Handle(new SetBattingOrderCommand(teamId, gameId, [playerId]), CancellationToken.None);

        await act.Should().ThrowAsync<DomainException>();
    }

    [Fact]
    public async Task AssignInningFielding_GameLocked_ThrowsDomainException()
    {
        var teamId = Guid.NewGuid();
        var gameId = Guid.NewGuid();
        var team = CreateTeam(teamId);
        var game = CreateGame(teamId, gameId);
        game.Apply(new GameLocked { TeamId = teamId, GameId = gameId });
        _store.GetTeam(teamId).Returns(team);
        _store.GetGame(gameId).Returns(game);

        var handler = new AssignInningFieldingCommandHandler(_eventStore, _store);
        var act = () => handler.Handle(
            new AssignInningFieldingCommand(teamId, gameId, 1, []),
            CancellationToken.None);

        await act.Should().ThrowAsync<DomainException>().WithMessage("*locked*");
    }

    [Fact]
    public async Task LockGame_AlreadyLocked_ThrowsDomainException()
    {
        var teamId = Guid.NewGuid();
        var gameId = Guid.NewGuid();
        var game = CreateGame(teamId, gameId);
        game.Apply(new GameLocked { TeamId = teamId, GameId = gameId });
        _store.GetGame(gameId).Returns(game);

        var handler = new LockGameCommandHandler(_eventStore, _store);
        var act = () => handler.Handle(new LockGameCommand(teamId, gameId), CancellationToken.None);

        await act.Should().ThrowAsync<DomainException>().WithMessage("*already locked*");
    }

    private static TeamAggregate CreateTeam(Guid teamId)
    {
        var t = new TeamAggregate();
        t.Apply(new TeamCreated { TeamId = teamId, Name = "T", SportName = "Softball", AccessSecretHash = "h" });
        return t;
    }

    private static void AddPlayer(TeamAggregate team, Guid playerId) =>
        team.Apply(new PlayerAdded { TeamId = team.TeamId, PlayerId = playerId, Name = "P" });

    private static GameAggregate CreateGame(Guid teamId, Guid gameId)
    {
        var g = new GameAggregate();
        g.Apply(new GameCreated
        {
            TeamId = teamId, GameId = gameId,
            Date = DateOnly.FromDateTime(DateTime.Today),
            InningCount = 6
        });
        return g;
    }
}
