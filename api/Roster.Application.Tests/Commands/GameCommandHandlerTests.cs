namespace Roster.Application.Tests.Commands;

using FluentAssertions;
using NSubstitute;
using Roster.Application.Commands.AssignInningFielding;
using Roster.Application.Commands.CreateGame;
using Roster.Application.Commands.LockGame;
using Roster.Application.Commands.MarkPlayerAbsent;
using Roster.Application.Commands.SetBattingOrder;
using Roster.Application.Commands.RecordGameScores;
using Roster.Application.Commands.RecordInningScore;
using Roster.Application.Commands.UpdateGameLineup;
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
    public async Task UpdateGameLineup_ValidCommand_EmitsBattingOrderSetAndAllInningFieldingEvents()
    {
        var teamId = Guid.NewGuid();
        var gameId = Guid.NewGuid();
        var p1 = Guid.NewGuid();
        var p2 = Guid.NewGuid();
        var team = CreateTeam(teamId);
        AddPlayer(team, p1);
        AddPlayer(team, p2);
        var game = CreateGame(teamId, gameId);
        _store.GetTeam(teamId).Returns(team);
        _store.GetGame(gameId).Returns(game);

        IReadOnlyList<DomainEvent>? captured = null;
        await _eventStore.AppendAsync(
            Arg.Do<IReadOnlyList<DomainEvent>>(e => captured = e),
            Arg.Any<CancellationToken>());

        var assignments = new Dictionary<int, IReadOnlyList<FieldingAssignmentDto>>
        {
            [1] = [new(p1, "Pitcher"), new(p2, "Catcher")],
            [2] = [new(p1, "Catcher"), new(p2, "Pitcher")],
        };

        var handler = new UpdateGameLineupCommandHandler(_eventStore, _store);
        await handler.Handle(new UpdateGameLineupCommand(teamId, gameId, [p1, p2], assignments), CancellationToken.None);

        captured.Should().HaveCount(3); // 1 BattingOrderSet + 2 InningFieldingAssigned
        captured![0].Should().BeOfType<BattingOrderSet>();
        captured.Skip(1).Should().AllBeOfType<InningFieldingAssigned>();
    }

    [Fact]
    public async Task UpdateGameLineup_GameLocked_ThrowsDomainException()
    {
        var teamId = Guid.NewGuid();
        var gameId = Guid.NewGuid();
        var team = CreateTeam(teamId);
        var game = CreateGame(teamId, gameId);
        game.Apply(new GameLocked { TeamId = teamId, GameId = gameId });
        _store.GetTeam(teamId).Returns(team);
        _store.GetGame(gameId).Returns(game);

        var handler = new UpdateGameLineupCommandHandler(_eventStore, _store);
        var act = () => handler.Handle(
            new UpdateGameLineupCommand(teamId, gameId, [], new Dictionary<int, IReadOnlyList<FieldingAssignmentDto>>()),
            CancellationToken.None);

        await act.Should().ThrowAsync<DomainException>().WithMessage("*locked*");
    }

    [Fact]
    public async Task UpdateGameLineup_AbsentPlayerInBattingOrder_ThrowsDomainException()
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

        var handler = new UpdateGameLineupCommandHandler(_eventStore, _store);
        var act = () => handler.Handle(
            new UpdateGameLineupCommand(teamId, gameId, [playerId], new Dictionary<int, IReadOnlyList<FieldingAssignmentDto>>()),
            CancellationToken.None);

        await act.Should().ThrowAsync<DomainException>();
    }

    [Fact]
    public async Task RecordGameScores_ValidPayload_EmitsSingleGameScoresRecordedEvent()
    {
        var teamId = Guid.NewGuid();
        var gameId = Guid.NewGuid();
        var game = CreateGame(teamId, gameId); // InningCount = 6
        _store.GetGame(gameId).Returns(game);

        IReadOnlyList<DomainEvent>? captured = null;
        await _eventStore.AppendAsync(
            Arg.Do<IReadOnlyList<DomainEvent>>(e => captured = e),
            Arg.Any<CancellationToken>());

        var scores = new Dictionary<int, InningScoreEntry>
        {
            [1] = new(2, 1),
            [2] = new(0, 3),
            [3] = new(1, 0),
        };

        var handler = new RecordGameScoresCommandHandler(_eventStore, _store);
        await handler.Handle(new RecordGameScoresCommand(teamId, gameId, scores), CancellationToken.None);

        captured.Should().HaveCount(1);
        var evt = captured![0].Should().BeOfType<GameScoresRecorded>().Subject;
        evt.InningScores.Should().HaveCount(3);
        evt.InningScores[1].HomeScore.Should().Be(2);
        evt.InningScores[1].AwayScore.Should().Be(1);
        evt.InningScores[2].AwayScore.Should().Be(3);
    }

    [Fact]
    public async Task RecordGameScores_InvalidInning_ThrowsDomainException()
    {
        var teamId = Guid.NewGuid();
        var gameId = Guid.NewGuid();
        var game = CreateGame(teamId, gameId); // InningCount = 6
        _store.GetGame(gameId).Returns(game);

        var handler = new RecordGameScoresCommandHandler(_eventStore, _store);
        var act = () => handler.Handle(
            new RecordGameScoresCommand(teamId, gameId, new Dictionary<int, InningScoreEntry> { [7] = new(0, 0) }),
            CancellationToken.None);

        await act.Should().ThrowAsync<DomainException>().WithMessage("*between 1 and 6*");
    }

    [Fact]
    public async Task RecordGameScores_NegativeScore_ThrowsDomainException()
    {
        var teamId = Guid.NewGuid();
        var gameId = Guid.NewGuid();
        var game = CreateGame(teamId, gameId);
        _store.GetGame(gameId).Returns(game);

        var handler = new RecordGameScoresCommandHandler(_eventStore, _store);
        var act = () => handler.Handle(
            new RecordGameScoresCommand(teamId, gameId, new Dictionary<int, InningScoreEntry> { [1] = new(-1, 0) }),
            CancellationToken.None);

        await act.Should().ThrowAsync<DomainException>().WithMessage("*negative*");
    }

    [Fact]
    public async Task RecordGameScores_GameNotFound_ThrowsDomainException()
    {
        _store.GetGame(Arg.Any<Guid>()).Returns((GameAggregate?)null);

        var handler = new RecordGameScoresCommandHandler(_eventStore, _store);
        var act = () => handler.Handle(
            new RecordGameScoresCommand(Guid.NewGuid(), Guid.NewGuid(), new Dictionary<int, InningScoreEntry>()),
            CancellationToken.None);

        await act.Should().ThrowAsync<DomainException>();
    }

    [Fact]
    public async Task RecordGameScores_GameAggregateAppliesAllScores()
    {
        var teamId = Guid.NewGuid();
        var gameId = Guid.NewGuid();
        var game = CreateGame(teamId, gameId);

        game.Apply(new GameScoresRecorded
        {
            TeamId = teamId,
            GameId = gameId,
            InningScores = new Dictionary<int, GameInningScore>
            {
                [1] = new(3, 1),
                [2] = new(0, 2),
            },
        });

        game.InningScores[1].HomeScore.Should().Be(3);
        game.InningScores[1].AwayScore.Should().Be(1);
        game.InningScores[2].AwayScore.Should().Be(2);
    }

    [Fact]
    public async Task RecordInningScore_ValidScore_EmitsInningScoreRecordedEvent()
    {
        var teamId = Guid.NewGuid();
        var gameId = Guid.NewGuid();
        var game = CreateGame(teamId, gameId);
        _store.GetGame(gameId).Returns(game);

        IReadOnlyList<DomainEvent>? captured = null;
        await _eventStore.AppendAsync(
            Arg.Do<IReadOnlyList<DomainEvent>>(e => captured = e),
            Arg.Any<CancellationToken>());

        var handler = new RecordInningScoreCommandHandler(_eventStore, _store);
        await handler.Handle(new RecordInningScoreCommand(teamId, gameId, 3, 2, 1), CancellationToken.None);

        captured.Should().HaveCount(1);
        var evt = captured![0].Should().BeOfType<InningScoreRecorded>().Subject;
        evt.InningNumber.Should().Be(3);
        evt.HomeScore.Should().Be(2);
        evt.AwayScore.Should().Be(1);
    }

    [Fact]
    public async Task RecordInningScore_InvalidInning_ThrowsDomainException()
    {
        var teamId = Guid.NewGuid();
        var gameId = Guid.NewGuid();
        var game = CreateGame(teamId, gameId); // InningCount = 6
        _store.GetGame(gameId).Returns(game);

        var handler = new RecordInningScoreCommandHandler(_eventStore, _store);
        var act = () => handler.Handle(new RecordInningScoreCommand(teamId, gameId, 7, 0, 0), CancellationToken.None);

        await act.Should().ThrowAsync<DomainException>().WithMessage("*between 1 and 6*");
    }

    [Fact]
    public async Task RecordInningScore_NegativeScore_ThrowsDomainException()
    {
        var teamId = Guid.NewGuid();
        var gameId = Guid.NewGuid();
        var game = CreateGame(teamId, gameId);
        _store.GetGame(gameId).Returns(game);

        var handler = new RecordInningScoreCommandHandler(_eventStore, _store);
        var act = () => handler.Handle(new RecordInningScoreCommand(teamId, gameId, 1, -1, 0), CancellationToken.None);

        await act.Should().ThrowAsync<DomainException>().WithMessage("*negative*");
    }

    [Fact]
    public async Task RecordInningScore_GameNotFound_ThrowsDomainException()
    {
        _store.GetGame(Arg.Any<Guid>()).Returns((GameAggregate?)null);

        var handler = new RecordInningScoreCommandHandler(_eventStore, _store);
        var act = () => handler.Handle(new RecordInningScoreCommand(Guid.NewGuid(), Guid.NewGuid(), 1, 0, 0), CancellationToken.None);

        await act.Should().ThrowAsync<DomainException>();
    }

    [Fact]
    public async Task RecordInningScore_ScoreCanBeUpdatedOnLockedGame()
    {
        var teamId = Guid.NewGuid();
        var gameId = Guid.NewGuid();
        var game = CreateGame(teamId, gameId);
        game.Apply(new GameLocked { TeamId = teamId, GameId = gameId });
        _store.GetGame(gameId).Returns(game);

        IReadOnlyList<DomainEvent>? captured = null;
        await _eventStore.AppendAsync(
            Arg.Do<IReadOnlyList<DomainEvent>>(e => captured = e),
            Arg.Any<CancellationToken>());

        var handler = new RecordInningScoreCommandHandler(_eventStore, _store);
        await handler.Handle(new RecordInningScoreCommand(teamId, gameId, 1, 3, 2), CancellationToken.None);

        captured.Should().HaveCount(1);
        captured![0].Should().BeOfType<InningScoreRecorded>();
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
