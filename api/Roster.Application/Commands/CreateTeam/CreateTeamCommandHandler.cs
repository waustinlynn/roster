namespace Roster.Application.Commands.CreateTeam;

using MediatR;
using Roster.Application.Interfaces;
using Roster.Domain.Events;
using Roster.Domain.Exceptions;
using Roster.Domain.Interfaces;
using Roster.Domain.ValueObjects;

public class CreateTeamCommandHandler : IRequestHandler<CreateTeamCommand, CreateTeamResult>
{
    private readonly IEventStore _eventStore;
    private readonly IAccessSecretService _secretService;

    public CreateTeamCommandHandler(IEventStore eventStore, IAccessSecretService secretService)
    {
        _eventStore = eventStore;
        _secretService = secretService;
    }

    public async Task<CreateTeamResult> Handle(CreateTeamCommand request, CancellationToken cancellationToken)
    {
        var sport = Sport.FindByName(request.SportName)
            ?? throw new DomainException($"Unknown sport: '{request.SportName}'. Supported sports: Softball.");

        var (plaintext, hash) = _secretService.GenerateSecret();
        var teamId = Guid.NewGuid();

        var @event = new TeamCreated
        {
            TeamId = teamId,
            Name = request.Name,
            SportName = sport.Name,
            AccessSecretHash = hash,
        };

        await _eventStore.AppendAsync([@event], cancellationToken);

        return new CreateTeamResult(teamId, plaintext);
    }
}
