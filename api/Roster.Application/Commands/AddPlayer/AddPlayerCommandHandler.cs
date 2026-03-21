namespace Roster.Application.Commands.AddPlayer;

using MediatR;
using Roster.Application.Interfaces;
using Roster.Domain.Events;
using Roster.Domain.Exceptions;
using Roster.Domain.Interfaces;

public class AddPlayerCommandHandler : IRequestHandler<AddPlayerCommand, AddPlayerResult>
{
    private readonly IEventStore _eventStore;
    private readonly IInMemoryStore _store;

    public AddPlayerCommandHandler(IEventStore eventStore, IInMemoryStore store)
    {
        _eventStore = eventStore;
        _store = store;
    }

    public async Task<AddPlayerResult> Handle(AddPlayerCommand request, CancellationToken cancellationToken)
    {
        var team = _store.GetTeam(request.TeamId)
            ?? throw new DomainException($"Team {request.TeamId} not found.");

        if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Length > 100)
            throw new DomainException("Player name must be between 1 and 100 characters.");

        var playerId = Guid.NewGuid();
        var @event = new PlayerAdded
        {
            TeamId = request.TeamId,
            PlayerId = playerId,
            Name = request.Name,
        };

        await _eventStore.AppendAsync([@event], cancellationToken);
        return new AddPlayerResult(playerId);
    }
}
