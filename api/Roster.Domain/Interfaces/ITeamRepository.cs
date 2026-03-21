namespace Roster.Domain.Interfaces;
using Roster.Domain.Aggregates;

public interface ITeamRepository
{
    TeamAggregate? GetById(Guid teamId);
    TeamAggregate? GetBySecretHash(string secretHash);
    void Apply(Domain.Events.DomainEvent e);
}
