namespace Roster.Application.Commands.RecordInningScore;

using MediatR;
using Roster.Application.Interfaces;
using Roster.Domain.Events;
using Roster.Domain.Exceptions;
using Roster.Domain.Interfaces;

public class RecordInningScoreCommandHandler : IRequestHandler<RecordInningScoreCommand>
{
    private readonly IEventStore _eventStore;
    private readonly IInMemoryStore _store;

    public RecordInningScoreCommandHandler(IEventStore eventStore, IInMemoryStore store)
    {
        _eventStore = eventStore;
        _store = store;
    }

    public async Task Handle(RecordInningScoreCommand request, CancellationToken cancellationToken)
    {
        var game = _store.GetGame(request.GameId)
            ?? throw new DomainException($"Game {request.GameId} not found.");

        if (request.InningNumber < 1 || request.InningNumber > game.InningCount)
            throw new DomainException($"Inning number must be between 1 and {game.InningCount}.");

        if (request.HomeScore < 0 || request.AwayScore < 0)
            throw new DomainException("Scores cannot be negative.");

        await _eventStore.AppendAsync([new InningScoreRecorded
        {
            TeamId = request.TeamId,
            GameId = request.GameId,
            InningNumber = request.InningNumber,
            HomeScore = request.HomeScore,
            AwayScore = request.AwayScore,
        }], cancellationToken);
    }
}
