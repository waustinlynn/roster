namespace Roster.Application.Commands.CreateGame;

using MediatR;
using Roster.Application.Interfaces;
using Roster.Domain.Events;
using Roster.Domain.Exceptions;
using Roster.Domain.Interfaces;

public class CreateGameCommandHandler : IRequestHandler<CreateGameCommand, CreateGameResult>
{
    private readonly IEventStore _eventStore;
    private readonly IInMemoryStore _store;

    public CreateGameCommandHandler(IEventStore eventStore, IInMemoryStore store)
    {
        _eventStore = eventStore;
        _store = store;
    }

    public async Task<CreateGameResult> Handle(CreateGameCommand request, CancellationToken cancellationToken)
    {
        _ = _store.GetTeam(request.TeamId)
            ?? throw new DomainException($"Team {request.TeamId} not found.");

        if (!DateOnly.TryParseExact(request.Date, "yyyy-MM-dd", out var date))
            throw new DomainException($"Invalid date '{request.Date}'. Use YYYY-MM-DD.");

        if (request.InningCount < 1 || request.InningCount > 12)
            throw new DomainException("Inning count must be between 1 and 12.");

        if (request.Opponent?.Length > 100)
            throw new DomainException("Opponent name must be 100 characters or less.");

        var gameId = Guid.NewGuid();
        await _eventStore.AppendAsync([new GameCreated
        {
            TeamId = request.TeamId,
            GameId = gameId,
            Date = date,
            Opponent = request.Opponent,
            InningCount = request.InningCount,
        }], cancellationToken);

        return new CreateGameResult(gameId);
    }
}
