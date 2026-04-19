namespace Roster.Application.Commands.RecordGameScores;

using MediatR;
using Roster.Application.Interfaces;
using Roster.Domain.Events;
using Roster.Domain.Exceptions;
using Roster.Domain.Interfaces;

public class RecordGameScoresCommandHandler : IRequestHandler<RecordGameScoresCommand>
{
    private readonly IEventStore _eventStore;
    private readonly IInMemoryStore _store;

    public RecordGameScoresCommandHandler(IEventStore eventStore, IInMemoryStore store)
    {
        _eventStore = eventStore;
        _store = store;
    }

    public async Task Handle(RecordGameScoresCommand request, CancellationToken cancellationToken)
    {
        var game = _store.GetGame(request.GameId)
            ?? throw new DomainException($"Game {request.GameId} not found.");

        foreach (var (inning, score) in request.InningScores)
        {
            if (inning < 1 || inning > game.InningCount)
                throw new DomainException($"Inning number must be between 1 and {game.InningCount}.");
            if (score.HomeScore < 0 || score.AwayScore < 0)
                throw new DomainException("Scores cannot be negative.");
        }

        var inningScores = request.InningScores.ToDictionary(
            kvp => kvp.Key,
            kvp => new GameInningScore(kvp.Value.HomeScore, kvp.Value.AwayScore));

        await _eventStore.AppendAsync([new GameScoresRecorded
        {
            TeamId = request.TeamId,
            GameId = request.GameId,
            InningScores = inningScores,
        }], cancellationToken);
    }
}
