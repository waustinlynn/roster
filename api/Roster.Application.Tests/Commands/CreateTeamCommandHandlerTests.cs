namespace Roster.Application.Tests.Commands;

using FluentAssertions;
using NSubstitute;
using Roster.Application.Commands.CreateTeam;
using Roster.Domain.Events;
using Roster.Domain.Interfaces;
using Roster.Infrastructure.Security;

public class CreateTeamCommandHandlerTests
{
    private readonly IEventStore _eventStore;
    private readonly AccessSecretService _secretService;
    private readonly CreateTeamCommandHandler _handler;

    public CreateTeamCommandHandlerTests()
    {
        _eventStore = Substitute.For<IEventStore>();
        _secretService = new AccessSecretService();
        _handler = new CreateTeamCommandHandler(_eventStore, _secretService);
    }

    [Fact]
    public async Task Handle_ValidCommand_EmitsOneTeamCreatedEvent()
    {
        IReadOnlyList<DomainEvent>? capturedEvents = null;
        await _eventStore.AppendAsync(
            Arg.Do<IReadOnlyList<DomainEvent>>(e => capturedEvents = e),
            Arg.Any<CancellationToken>());

        var command = new CreateTeamCommand("Thunderbolts", "Softball");
        await _handler.Handle(command, CancellationToken.None);

        capturedEvents.Should().HaveCount(1);
        capturedEvents![0].Should().BeOfType<TeamCreated>();
    }

    [Fact]
    public async Task Handle_ValidCommand_AccessSecretHashIsNotPlaintext()
    {
        IReadOnlyList<DomainEvent>? capturedEvents = null;
        await _eventStore.AppendAsync(
            Arg.Do<IReadOnlyList<DomainEvent>>(e => capturedEvents = e),
            Arg.Any<CancellationToken>());

        var command = new CreateTeamCommand("Thunderbolts", "Softball");
        var result = await _handler.Handle(command, CancellationToken.None);

        var teamCreated = (TeamCreated)capturedEvents![0];
        teamCreated.AccessSecretHash.Should().NotBe(result.AccessSecret);
        teamCreated.AccessSecretHash.Should().HaveLength(64); // SHA-256 hex = 64 chars
    }

    [Fact]
    public async Task Handle_InvalidSportName_ThrowsDomainException()
    {
        var command = new CreateTeamCommand("Team", "Rugby");

        var act = () => _handler.Handle(command, CancellationToken.None);

        await act.Should().ThrowAsync<Roster.Domain.Exceptions.DomainException>();
    }
}
