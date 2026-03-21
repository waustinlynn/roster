namespace Roster.Application.Commands.RatePlayerSkill;

using MediatR;
using Roster.Application.Interfaces;
using Roster.Domain.Events;
using Roster.Domain.Exceptions;
using Roster.Domain.Interfaces;

public class RatePlayerSkillCommandHandler : IRequestHandler<RatePlayerSkillCommand>
{
    private readonly IEventStore _eventStore;
    private readonly IInMemoryStore _store;

    public RatePlayerSkillCommandHandler(IEventStore eventStore, IInMemoryStore store)
    {
        _eventStore = eventStore;
        _store = store;
    }

    public async Task Handle(RatePlayerSkillCommand request, CancellationToken cancellationToken)
    {
        var team = _store.GetTeam(request.TeamId)
            ?? throw new DomainException($"Team {request.TeamId} not found.");

        if (!team.Players.TryGetValue(request.PlayerId, out var player))
            throw new DomainException($"Player {request.PlayerId} not found.");

        if (!player.IsActive)
            throw new DomainException($"Player '{player.Name}' is not active.");

        if (!team.Sport!.Skills.Contains(request.SkillName, StringComparer.OrdinalIgnoreCase))
            throw new DomainException($"'{request.SkillName}' is not a valid skill for {team.Sport.Name}. Valid skills: {string.Join(", ", team.Sport.Skills)}.");

        if (request.Rating < 1 || request.Rating > 5)
            throw new DomainException($"Skill rating must be between 1 and 5, got {request.Rating}.");

        var @event = new PlayerSkillRated
        {
            TeamId = request.TeamId,
            PlayerId = request.PlayerId,
            SkillName = request.SkillName,
            Rating = request.Rating,
        };

        await _eventStore.AppendAsync([@event], cancellationToken);
    }
}
