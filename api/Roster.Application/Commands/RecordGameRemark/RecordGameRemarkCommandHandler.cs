namespace Roster.Application.Commands.RecordGameRemark;

using MediatR;
using Roster.Application.Interfaces;
using Roster.Domain.Events;
using Roster.Domain.Exceptions;
using Roster.Domain.Interfaces;

public class RecordGameRemarkCommandHandler : IRequestHandler<RecordGameRemarkCommand>
{
    private readonly IEventStore _eventStore;
    private readonly IInMemoryStore _store;

    public RecordGameRemarkCommandHandler(IEventStore eventStore, IInMemoryStore store)
    {
        _eventStore = eventStore;
        _store = store;
    }

    public async Task Handle(RecordGameRemarkCommand request, CancellationToken cancellationToken)
    {
        var game = _store.GetGame(request.GameId)
            ?? throw new DomainException($"Game {request.GameId} not found.");

        if (string.IsNullOrWhiteSpace(request.Remark))
            throw new DomainException("Remark cannot be empty.");

        await _eventStore.AppendAsync([new GameRemarkRecorded
        {
            TeamId = request.TeamId,
            GameId = request.GameId,
            Remark = request.Remark.Trim(),
        }], cancellationToken);
    }
}
